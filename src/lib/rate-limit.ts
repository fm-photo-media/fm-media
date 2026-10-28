import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";

// SEC-4 (and SEC-3 in batch 3): a small sliding-window limiter backed by the
// RateLimitAttempt table. No new accounts or services. Keys are "<scope>:<hash>",
// where the hash is a salted SHA-256 of the client IP, so raw IPs are never stored.

export type AttemptStore = {
  record(key: string, at: Date): Promise<void>;
  countSince(key: string, since: Date): Promise<number>;
  pruneBefore(before: Date): Promise<void>;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Records this attempt, then counts attempts in the window (including this one).
 * Recording first means two racing requests can't both slip under the limit.
 */
export async function hitRateLimit(
  store: AttemptStore,
  { key, limit, windowMs, now = new Date() }: { key: string; limit: number; windowMs: number; now?: Date }
) {
  await store.record(key, now);
  const count = await store.countSince(key, new Date(now.getTime() - windowMs));
  await store.pruneBefore(new Date(now.getTime() - Math.max(windowMs, DAY)));
  return { allowed: count <= limit, count };
}

export function hashClientId(ip: string, salt: string) {
  return crypto.createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 32);
}

/** On Vercel, x-forwarded-for / x-real-ip are set by the platform to the client IP. */
export function clientIpFrom(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}

export function prismaAttemptStore(prisma: PrismaClient): AttemptStore {
  return {
    record: async (key, at) => {
      await prisma.rateLimitAttempt.create({ data: { key, createdAt: at } });
    },
    countSince: (key, since) => prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: since } } }),
    pruneBefore: async (before) => {
      await prisma.rateLimitAttempt.deleteMany({ where: { createdAt: { lt: before } } });
    }
  };
}

export const RATE_LIMITS = {
  booking: { limit: 10, windowMs: 60 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 }
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

function salt() {
  return process.env.RATE_LIMIT_SALT || process.env.ADMIN_SESSION_SECRET || "fm-media-rate-limit";
}

/**
 * Server-side entry point. Fails open (allows the request) if the DB call fails,
 * so a limiter hiccup never blocks a real customer; the error is logged.
 */
export async function checkRateLimit(prisma: PrismaClient, scope: RateLimitScope, headers: Headers) {
  const { limit, windowMs } = RATE_LIMITS[scope];
  const key = `${scope}:${hashClientId(clientIpFrom(headers), salt())}`;
  try {
    return await hitRateLimit(prismaAttemptStore(prisma), { key, limit, windowMs });
  } catch (error) {
    console.error(`[rate-limit] ${scope} check failed; allowing the request`, error);
    return { allowed: true, count: 0 };
  }
}
