import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RATE_LIMITS,
  clientIpFrom,
  clientKeyFromIp,
  formatWait,
  hashClientId,
  hitRateLimit,
  limitWithStore,
  checkLoginLimit,
  loginVolumeAlarm,
  loginWaitMessage,
  rateLimitSaltFrom,
  type AttemptStore
} from "./rate-limit";

function memoryStore() {
  const rows: { key: string; createdAt: Date }[] = [];
  const store: AttemptStore = {
    record: async (key, createdAt) => {
      rows.push({ key, createdAt });
    },
    countSince: async (key, since) => rows.filter((r) => r.key === key && r.createdAt >= since).length,
    nthOldestSince: async (key, since, n) =>
      rows
        .filter((r) => r.key === key && r.createdAt >= since)
        .map((r) => r.createdAt)
        .sort((a, b) => a.getTime() - b.getTime())[n - 1] ?? null,
    pruneBefore: async (before) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].createdAt < before) rows.splice(i, 1);
    }
  };
  return { store, rows };
}

function failingStore(failOn: keyof AttemptStore | "all"): AttemptStore {
  const { store } = memoryStore();
  const boom = async () => {
    throw new Error("db down");
  };
  if (failOn === "all") return { record: boom, countSince: boom, nthOldestSince: boom, pruneBefore: boom };
  return { ...store, [failOn]: boom };
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const t0 = new Date("2027-01-14T16:00:00Z");
const later = (ms: number) => new Date(t0.getTime() + ms);
const hourly = [{ limit: 3, windowMs: HOUR }];
const always = () => 0; // always prune, for deterministic tests

test("allows up to the limit inside the window, then blocks", async () => {
  const { store } = memoryStore();
  for (let i = 1; i <= 3; i++) {
    assert.equal((await hitRateLimit(store, { key: "booking:a", windows: hourly, now: later(i) })).allowed, true);
  }
  assert.equal((await hitRateLimit(store, { key: "booking:a", windows: hourly, now: later(4) })).allowed, false);
});

test("QA-18: blocked retries are not recorded, so they don't extend the lockout", async () => {
  const { store, rows } = memoryStore();
  for (let i = 0; i < 3; i++) await hitRateLimit(store, { key: "booking:a", windows: hourly, now: t0 });
  // Keep retrying every 5 minutes for 55 minutes.
  for (let m = 5; m < 60; m += 5) {
    assert.equal((await hitRateLimit(store, { key: "booking:a", windows: hourly, now: later(m * MIN) })).allowed, false);
  }
  assert.equal(rows.length, 3, "only the allowed attempts are stored");
  assert.equal((await hitRateLimit(store, { key: "booking:a", windows: hourly, now: later(HOUR + 1) })).allowed, true);
});

test("QA-18: a blocked result says how long until the next attempt is allowed", async () => {
  const { store } = memoryStore();
  await hitRateLimit(store, { key: "k", windows: hourly, now: t0 });
  await hitRateLimit(store, { key: "k", windows: hourly, now: later(10 * MIN) });
  await hitRateLimit(store, { key: "k", windows: hourly, now: later(20 * MIN) });
  const blocked = await hitRateLimit(store, { key: "k", windows: hourly, now: later(25 * MIN) });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 35 * MIN, "the oldest attempt leaves the window at t0 + 60 min");
  assert.equal(formatWait(blocked.retryAfterMs), "about 35 minutes");
  assert.equal(formatWait(30 * 1000), "about 1 minute");
  assert.equal(formatWait(3 * HOUR + 10 * MIN), "about 4 hours");
});

test("the window slides: old attempts stop counting", async () => {
  const { store } = memoryStore();
  for (let i = 0; i < 3; i++) await hitRateLimit(store, { key: "booking:a", windows: hourly, now: t0 });
  assert.equal((await hitRateLimit(store, { key: "booking:a", windows: hourly, now: later(HOUR + 1) })).allowed, true);
});

test("SEC-17: bookings have a 20/day per-IP cap on top of 10/hour", async () => {
  const { store } = memoryStore();
  const windows = RATE_LIMITS.booking.windows;
  assert.deepEqual(
    windows.map((w) => [w.limit, w.windowMs]),
    [
      [10, HOUR],
      [20, 24 * HOUR]
    ]
  );
  let allowed = 0;
  // 10 per hour for 3 hours would be 30 without a daily cap.
  for (let h = 0; h < 3; h++) {
    for (let i = 0; i < 10; i++) {
      const now = later(h * (HOUR + MIN) + i);
      if ((await hitRateLimit(store, { key: "booking:a", windows, now, random: always })).allowed) allowed++;
    }
  }
  assert.equal(allowed, 20);
  const next = await hitRateLimit(store, { key: "booking:a", windows, now: later(3 * HOUR) });
  assert.equal(next.allowed, false);
  assert.equal(formatWait(next.retryAfterMs), "about 21 hours");
});

test("SEC-17: the notification email cap is 80 a day across everyone", async () => {
  const { store } = memoryStore();
  const windows = RATE_LIMITS.notificationEmail.windows;
  let sent = 0;
  for (let i = 0; i < 100; i++) {
    if ((await hitRateLimit(store, { key: "email:global", windows, now: later(i * MIN) })).allowed) sent++;
  }
  assert.equal(sent, 80);
  assert.equal((await hitRateLimit(store, { key: "email:global", windows, now: later(24 * HOUR + 1) })).allowed, true);
});

test("keys are independent (per client and per scope)", async () => {
  const { store } = memoryStore();
  for (let i = 0; i < 3; i++) await hitRateLimit(store, { key: "booking:a", windows: hourly, now: t0 });
  assert.equal((await hitRateLimit(store, { key: "booking:b", windows: hourly, now: t0 })).allowed, true);
  assert.equal((await hitRateLimit(store, { key: "login:a", windows: hourly, now: t0 })).allowed, true);
});

test("rows older than a day are pruned", async () => {
  const { store, rows } = memoryStore();
  await hitRateLimit(store, { key: "booking:a", windows: hourly, now: t0, random: always });
  await hitRateLimit(store, { key: "booking:b", windows: hourly, now: later(25 * HOUR), random: always });
  assert.deepEqual(rows.map((r) => r.key), ["booking:b"]);
});

test("SEC-16: the login limiter fails CLOSED when the DB errors", async () => {
  for (const failOn of ["all", "record", "countSince"] as const) {
    const result = await limitWithStore(failingStore(failOn), "login", "abc", { now: t0 });
    assert.equal(result.allowed, false, `login with ${failOn} failing`);
    assert.equal(result.failed, true);
  }
});

test("SEC-16: bookings fail open, so a DB hiccup never blocks a customer", async () => {
  const result = await limitWithStore(failingStore("all"), "booking", "abc", { now: t0 });
  assert.equal(result.allowed, true);
  assert.equal(result.failed, true);
});

test("SEC-16: a failing prune can't override a decision", async () => {
  const store = failingStore("pruneBefore");
  for (let i = 0; i < RATE_LIMITS.login.windows[0].limit; i++) {
    const r = await limitWithStore(store, "login", "abc", { now: later(i), random: always });
    assert.equal(r.allowed, true);
    assert.equal(r.failed, false);
  }
  assert.equal((await limitWithStore(store, "login", "abc", { now: later(11), random: always })).allowed, false);
});

test("the client id is an HMAC of the IP with the salt, never stored raw", () => {
  const a = hashClientId("203.0.113.9", "salt-1");
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes("203"));
  assert.equal(a, hashClientId("203.0.113.9", "salt-1"));
  assert.notEqual(a, hashClientId("203.0.113.9", "salt-2"));
  assert.notEqual(a, hashClientId("203.0.113.10", "salt-1"));
});

test("client IP comes from the first forwarded hop", () => {
  assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientIpFrom(new Headers()), "unknown");
  assert.equal(clientIpFrom(new Headers({ "x-forwarded-for": "x".repeat(500) })).length, 64);
});

test("SEC-17: IPv6 clients are keyed on their /64, IPv4 on the full address", () => {
  assert.equal(clientKeyFromIp("2001:db8:abcd:12:1:2:3:4"), "2001:db8:abcd:12::/64");
  assert.equal(clientKeyFromIp("2001:db8:abcd:12::99"), "2001:db8:abcd:12::/64");
  assert.equal(clientKeyFromIp("2001:DB8:ABCD:0012:ffff::1"), "2001:db8:abcd:12::/64");
  assert.equal(clientKeyFromIp("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(clientKeyFromIp("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(clientKeyFromIp("203.0.113.9"), "203.0.113.9");
  assert.equal(clientKeyFromIp("unknown"), "unknown");
});

test("SEC-20: production requires RATE_LIMIT_SALT (32+ chars, no placeholder, no fallback)", () => {
  const salt = "a-random-rate-limit-salt-0123456789abc";
  assert.equal(rateLimitSaltFrom({ NODE_ENV: "production", RATE_LIMIT_SALT: salt }), salt);
  for (const value of [undefined, "", "short", "replace-with-32-plus-random-characters"]) {
    assert.throws(
      () => rateLimitSaltFrom({ NODE_ENV: "production", RATE_LIMIT_SALT: value, ADMIN_SESSION_SECRET: salt }),
      /RATE_LIMIT_SALT/
    );
  }
  // Outside production a missing salt becomes a per-process random value, never a public constant.
  const dev = rateLimitSaltFrom({ NODE_ENV: "development" });
  assert.ok(dev.length >= 32);
  assert.ok(!/fm-media/.test(dev));
});

test("SEC-20: a missing production salt makes login fail closed, not open", async () => {
  const { store } = memoryStore();
  const result = await limitWithStore(store, "login", "203.0.113.9", {
    now: t0,
    env: { NODE_ENV: "production" }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.failed, true);
});

const DAYMS = 24 * HOUR;

test("Security rec: login is 5 per 15 min AND 20 a day per IP, failing closed", async () => {
  assert.deepEqual(
    RATE_LIMITS.login.windows.map((w) => [w.limit, w.windowMs]),
    [
      [5, 15 * MIN],
      [20, DAYMS]
    ]
  );
  assert.equal(RATE_LIMITS.login.perClient, true);
  assert.equal(RATE_LIMITS.login.failClosed, true);

  const { store } = memoryStore();
  const windows = RATE_LIMITS.login.windows;
  let allowed = 0;
  for (let i = 0; i < 8; i++) {
    if ((await hitRateLimit(store, { key: "login:a", windows, now: later(i * 1000) })).allowed) allowed++;
  }
  assert.equal(allowed, 5, "5 in 15 minutes");

  // 5 every 16 minutes for 5 rounds would be 25 without the daily cap.
  const { store: daily } = memoryStore();
  allowed = 0;
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < 5; i++) {
      const r = await hitRateLimit(daily, { key: "login:b", windows, now: later(round * 16 * MIN + i * 1000) });
      if (r.allowed) allowed++;
    }
  }
  assert.equal(allowed, 20, "20 a day");
  const blocked = await hitRateLimit(daily, { key: "login:b", windows, now: later(5 * 16 * MIN) });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 22 * HOUR, "waits for the day window, not 15 min");
});

test("Security rec: there is no blocking global login cap any more", () => {
  assert.equal("loginGlobal" in RATE_LIMITS, false);
  for (const [scope, policy] of Object.entries(RATE_LIMITS)) {
    if (!policy.perClient) assert.equal(policy.failClosed, false, `${scope} is site-wide, so it must never block`);
  }
});

test("the login volume alarm warns at 100+ attempts an hour and never throws", async () => {
  const { store } = memoryStore();
  const warnings: string[] = [];
  const warn = (msg: string) => {
    warnings.push(msg);
  };
  let alarms = 0;
  for (let i = 0; i < 101; i++) {
    if (await loginVolumeAlarm(store, { now: later(i * 1000), warn })) alarms++;
  }
  assert.equal(alarms, 1, "only the 101st attempt is over 100 an hour");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /high sign-in volume/);
  // Hours later it is quiet again.
  assert.equal(await loginVolumeAlarm(store, { now: later(3 * HOUR), warn }), false);
  // DB down: no throw, no alarm, so sign-in is never blocked by it.
  assert.equal(await loginVolumeAlarm(failingStore("all"), { now: t0, warn }), false);
});

test("login lockout copy handles waits up to 1440 minutes", () => {
  assert.equal(loginWaitMessage("1"), "Too many sign-in attempts. Try again in about 1 minute.");
  assert.equal(loginWaitMessage("15"), "Too many sign-in attempts. Try again in about 15 minutes.");
  assert.equal(loginWaitMessage("60"), "Too many sign-in attempts. Try again in about 1 hour.");
  assert.equal(loginWaitMessage("61"), "Too many sign-in attempts. Try again in about 1 hour and 1 minute.");
  assert.equal(loginWaitMessage("135"), "Too many sign-in attempts. Try again in about 2 hours and 15 minutes.");
  assert.equal(loginWaitMessage("1380"), "Too many sign-in attempts. Try again in about 23 hours.");
  assert.equal(loginWaitMessage("1440"), "Too many sign-in attempts. Try again in about 24 hours.");
  for (const bad of [undefined, "", "0", "abc", "1441", "99999", "1e3", "-5", "12.5", "0015"]) {
    assert.equal(loginWaitMessage(bad), "Too many sign-in attempts. Try again later.", String(bad));
  }
});

test("SEC-23: a blocked sign-in writes no row at all (not even the volume counter)", async () => {
  const { store, rows } = memoryStore();
  const ip = "203.0.113.50";
  for (let i = 0; i < 5; i++) {
    assert.equal((await checkLoginLimit(store, ip, { now: later(i * 1000), random: () => 1 })).allowed, true);
  }
  assert.equal(rows.filter((r) => r.key === "loginVolume:all").length, 5, "allowed attempts are counted");
  const before = rows.length;
  for (let i = 0; i < 20; i++) {
    const r = await checkLoginLimit(store, ip, { now: later(10_000 + i * 1000), random: () => 1 });
    assert.equal(r.allowed, false);
  }
  assert.equal(rows.length, before, "20 blocked attempts added no rows");
});

test("SEC-23: the volume alarm prunes old rows now and then, and a failing prune is ignored", async () => {
  const { store, rows } = memoryStore();
  await loginVolumeAlarm(store, { now: t0, random: () => 1 });
  await loginVolumeAlarm(store, { now: later(25 * HOUR), random: () => 0 });
  assert.deepEqual(rows.map((r) => r.createdAt.getTime()), [later(25 * HOUR).getTime()]);
  const flaky = failingStore("pruneBefore");
  assert.equal(await loginVolumeAlarm(flaky, { now: t0, random: () => 0, warn: () => {} }), false);
});
