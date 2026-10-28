import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import { isPlaceholderSecret } from "@/lib/secrets";

// A small sliding-window limiter backed by the RateLimitAttempt table (no new accounts
// or services). Keys are "<scope>:<hash>", where the hash is an HMAC of the client's
// IPv4 address or IPv6 /64 under RATE_LIMIT_SALT, so raw IPs are never stored.
//
// SEC-4 (batch 2) added it. Batch 3:
// - SEC-3 / SEC-16: a per-IP login scope that fails CLOSED (5 per 15 min, 20 a day),
//   plus a log-only volume alarm that never blocks.
// - SEC-17: a daily per-IP booking cap, IPv6 /64 keys, and a global daily cap on
//   notification emails.
// - QA-18: blocked attempts are not recorded (retrying doesn't extend the lockout),
//   and a blocked result says how long to wait.
// - SEC-20: HMAC with a required production salt, no public fallback.

export type AttemptStore = {
  record(key: string, at: Date): Promise<void>;
  countSince(key: string, since: Date): Promise<number>;
  /** createdAt of the n-th oldest attempt (1-based) at or after `since`, or null. */
  nthOldestSince(key: string, since: Date, n: number): Promise<Date | null>;
  pruneBefore(before: Date): Promise<void>;
};

export type LimitWindow = { limit: number; windowMs: number };
export type LimitResult = { allowed: boolean; retryAfterMs: number; failed: boolean };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PRUNE_PROBABILITY = 1 / 20;

export const RATE_LIMITS = {
  // Customers: 10 an hour and 20 a day per connection. Fails open.
  booking: { windows: [{ limit: 10, windowMs: HOUR }, { limit: 20, windowMs: DAY }], perClient: true, failClosed: false },
  // Admin sign-in: 5 per 15 minutes and 20 a day per connection. Fails closed.
  // There is no blocking site-wide cap: two IPs could keep one full and lock the owner
  // out (Security, batch 3 re-check). Site-wide volume is only logged (loginVolumeAlarm).
  login: { windows: [{ limit: 5, windowMs: 15 * MINUTE }, { limit: 20, windowMs: DAY }], perClient: true, failClosed: true },
  // Notification emails: 80 a day for the whole site (Resend's free plan allows 100).
  // Fails open: if the counter is down, the owner still gets the email.
  notificationEmail: { windows: [{ limit: 80, windowMs: DAY }], perClient: false, failClosed: false }
} as const satisfies Record<string, { windows: readonly LimitWindow[]; perClient: boolean; failClosed: boolean }>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

async function blockedFor(store: AttemptStore, key: string, windows: readonly LimitWindow[], now: Date, recorded: boolean) {
  let retryAfterMs = 0;
  let blocked = false;

  for (const { limit, windowMs } of windows) {
    const since = new Date(now.getTime() - windowMs);
    const count = await store.countSince(key, since);
    // Before recording, the next attempt needs count < limit; after, count <= limit.
    const over = recorded ? count > limit : count >= limit;
    if (!over) continue;
    blocked = true;
    // The attempt that has to age out before one more fits.
    const oldest = await store.nthOldestSince(key, since, count - limit + (recorded ? 0 : 1));
    const wait = oldest ? oldest.getTime() + windowMs - now.getTime() : windowMs;
    retryAfterMs = Math.max(retryAfterMs, wait);
  }

  return { blocked, retryAfterMs };
}

/**
 * Checks every window first and records the attempt only if it fits, so blocked
 * retries never extend the lockout (QA-18). After recording it counts again, so two
 * racing requests can't both slip under the limit.
 */
export async function hitRateLimit(
  store: AttemptStore,
  {
    key,
    windows,
    now = new Date(),
    random = Math.random
  }: { key: string; windows: readonly LimitWindow[]; now?: Date; random?: () => number }
): Promise<LimitResult> {
  const before = await blockedFor(store, key, windows, now, false);
  if (before.blocked) return { allowed: false, retryAfterMs: before.retryAfterMs, failed: false };

  await store.record(key, now);
  const after = await blockedFor(store, key, windows, now, true);

  // SEC-16: pruning is housekeeping. It runs now and then, and can't change the decision.
  if (random() < PRUNE_PROBABILITY) {
    const longest = Math.max(DAY, ...windows.map((w) => w.windowMs));
    try {
      await store.pruneBefore(new Date(now.getTime() - longest));
    } catch (error) {
      console.error("[rate-limit] prune failed (ignored)", error);
    }
  }

  return { allowed: !after.blocked, retryAfterMs: after.retryAfterMs, failed: false };
}

export function hashClientId(clientKey: string, salt: string) {
  return crypto.createHmac("sha256", salt).update(clientKey).digest("hex").slice(0, 32);
}

/** On Vercel, x-forwarded-for / x-real-ip are set by the platform to the client IP. */
export function clientIpFrom(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}

function expandIpv6(ip: string): string[] | null {
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...new Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  return groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g)) ? groups.map((g) => g.toLowerCase()) : null;
}

/**
 * SEC-17: one IPv6 customer line usually gets a whole /64, so IPv6 clients are keyed on
 * their first four groups. IPv4 (and IPv4-mapped IPv6) keeps the full address.
 */
export function clientKeyFromIp(ip: string) {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const groups = expandIpv6(ip.replace(/%.*$/, ""));
  if (!groups) return ip;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

type Env = Record<string, string | undefined>;

// Outside production: a random per-process salt, never a constant from this public repo.
const devSalt = crypto.randomBytes(32).toString("hex");

/** SEC-20: production needs its own RATE_LIMIT_SALT (32+ characters); nothing falls back. */
export function rateLimitSaltFrom(env: Env) {
  const salt = env.RATE_LIMIT_SALT;
  if (env.NODE_ENV !== "production") return salt || devSalt;
  if (!salt || salt.length < 32 || isPlaceholderSecret(salt)) {
    throw new Error("RATE_LIMIT_SALT must be set to 32+ random characters in production.");
  }
  return salt;
}

/**
 * Applies a scope's policy. On any error (DB down, missing salt) a fail-closed scope
 * blocks and a fail-open scope allows; `failed` tells the caller which happened.
 */
export async function limitWithStore(
  store: AttemptStore,
  scope: RateLimitScope,
  clientIp: string,
  { now = new Date(), random, env = process.env }: { now?: Date; random?: () => number; env?: Env } = {}
): Promise<LimitResult> {
  const { windows, perClient, failClosed } = RATE_LIMITS[scope];
  try {
    const key = perClient ? `${scope}:${hashClientId(clientKeyFromIp(clientIp), rateLimitSaltFrom(env))}` : `${scope}:all`;
    return await hitRateLimit(store, { key, windows, now, random });
  } catch (error) {
    console.error(`[rate-limit] ${scope} check failed; ${failClosed ? "BLOCKING" : "allowing"} the request`, error);
    return { allowed: !failClosed, retryAfterMs: failClosed ? 5 * MINUTE : 0, failed: true };
  }
}

export function prismaAttemptStore(prisma: PrismaClient): AttemptStore {
  return {
    record: async (key, at) => {
      await prisma.rateLimitAttempt.create({ data: { key, createdAt: at } });
    },
    countSince: (key, since) => prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } }),
    nthOldestSince: async (key, since, n) => {
      const row = await prisma.rateLimitAttempt.findFirst({
        where: { key, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        skip: Math.max(0, n - 1),
        select: { createdAt: true }
      });
      return row?.createdAt ?? null;
    },
    pruneBefore: async (before) => {
      await prisma.rateLimitAttempt.deleteMany({ where: { createdAt: { lt: before } } });
    }
  };
}

/** Server-side entry point for a scope. `headers` are the incoming request headers. */
export async function checkRateLimit(prisma: PrismaClient, scope: RateLimitScope, headers: Headers) {
  return limitWithStore(prismaAttemptStore(prisma), scope, clientIpFrom(headers));
}

/** "about 35 minutes", "about 4 hours": always rounds up, so it never undersells the wait. */
export function formatWait(ms: number) {
  if (ms <= HOUR) {
    const minutes = Math.max(1, Math.ceil(ms / MINUTE));
    return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.ceil(ms / HOUR);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

// Site-wide sign-in volume: an alarm only. It is never used to block a sign-in.
const LOGIN_VOLUME_WINDOWS = [{ limit: 100, windowMs: HOUR }] as const;
const LOGIN_VOLUME_KEY = "loginVolume:all";

/**
 * Records one sign-in attempt in the site-wide counter and logs a warning when there
 * have been more than 100 in the last hour. Returns true when it warned. Never throws
 * and never blocks: on a DB error it just returns false.
 */
export async function loginVolumeAlarm(
  store: AttemptStore,
  {
    now = new Date(),
    warn = console.warn,
    random = Math.random
  }: { now?: Date; warn?: (message: string) => void; random?: () => number } = {}
) {
  try {
    const since = new Date(now.getTime() - HOUR);
    await store.record(LOGIN_VOLUME_KEY, now);
    // SEC-23: housekeeping, as in hitRateLimit. A failing prune changes nothing.
    if (random() < PRUNE_PROBABILITY) {
      await store.pruneBefore(new Date(now.getTime() - DAY)).catch((error) => {
        console.error("[rate-limit] prune failed (ignored)", error);
      });
    }
    const count = await store.countSince(LOGIN_VOLUME_KEY, since);
    if (count <= LOGIN_VOLUME_WINDOWS[0].limit) return false;
    // Warn once as the threshold is crossed, then every 100 attempts after that.
    if ((count - LOGIN_VOLUME_WINDOWS[0].limit) % 100 !== 1) return false;
    warn(`[admin-auth] high sign-in volume: ${count} attempts in the last hour (log only, nothing blocked)`);
    return true;
  } catch (error) {
    console.error("[rate-limit] login volume alarm failed (ignored)", error);
    return false;
  }
}

/**
 * Admin sign-in limit: the per-IP check (5 per 15 min, 20 a day, fails closed), then,
 * ONLY if that allowed the attempt, the log-only volume alarm. SEC-23 / QA-18: a blocked
 * attempt writes no row at all.
 */
export async function checkLoginLimit(
  store: AttemptStore,
  clientIp: string,
  options: { now?: Date; random?: () => number; env?: Env; warn?: (message: string) => void } = {}
): Promise<LimitResult> {
  const result = await limitWithStore(store, "login", clientIp, options);
  if (result.allowed) await loginVolumeAlarm(store, options);
  return result;
}

/** Server-side entry point for the admin sign-in limit. */
export function checkAdminLoginLimit(prisma: PrismaClient, headers: Headers) {
  return checkLoginLimit(prismaAttemptStore(prisma), clientIpFrom(headers));
}

const MAX_LOGIN_WAIT_MINUTES = 24 * 60;

/** "about 2 hours and 15 minutes": a duration in minutes, for waits up to a day. */
export function formatWaitMinutes(totalMinutes: number) {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (totalMinutes < 60) return `about ${plural(totalMinutes, "minute")}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `about ${plural(hours, "hour")}` : `about ${plural(hours, "hour")} and ${plural(minutes, "minute")}`;
}

/** The login page's lockout copy from its `wait` query param (whole minutes, 1 to 1440). */
export function loginWaitMessage(wait: string | undefined) {
  const minutes = wait && /^[1-9]\d{0,3}$/.test(wait) ? Number(wait) : null;
  return minutes && minutes <= MAX_LOGIN_WAIT_MINUTES
    ? `Too many sign-in attempts. Try again in ${formatWaitMinutes(minutes)}.`
    : "Too many sign-in attempts. Try again later.";
}
