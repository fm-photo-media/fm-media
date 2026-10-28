import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIpFrom, hashClientId, hitRateLimit, type AttemptStore } from "./rate-limit";

function memoryStore() {
  const rows: { key: string; createdAt: Date }[] = [];
  const store: AttemptStore = {
    record: async (key, createdAt) => {
      rows.push({ key, createdAt });
    },
    countSince: async (key, since) => rows.filter((r) => r.key === key && r.createdAt >= since).length,
    pruneBefore: async (before) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].createdAt < before) rows.splice(i, 1);
    }
  };
  return { store, rows };
}

const HOUR = 60 * 60 * 1000;
const t0 = new Date("2027-01-14T16:00:00Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

test("allows up to the limit inside the window, then blocks", async () => {
  const { store } = memoryStore();
  for (let i = 1; i <= 3; i++) {
    assert.equal((await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: later(i) })).allowed, true);
  }
  assert.equal((await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: later(4) })).allowed, false);
});

test("the window slides: old attempts stop counting", async () => {
  const { store } = memoryStore();
  for (let i = 0; i < 4; i++) await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: t0 });
  assert.equal((await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: later(HOUR + 1) })).allowed, true);
});

test("keys are independent (per client and per scope)", async () => {
  const { store } = memoryStore();
  for (let i = 0; i < 3; i++) await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: t0 });
  assert.equal((await hitRateLimit(store, { key: "booking:b", limit: 3, windowMs: HOUR, now: t0 })).allowed, true);
  assert.equal((await hitRateLimit(store, { key: "login:a", limit: 3, windowMs: HOUR, now: t0 })).allowed, true);
});

test("rows older than a day are pruned", async () => {
  const { store, rows } = memoryStore();
  await hitRateLimit(store, { key: "booking:a", limit: 3, windowMs: HOUR, now: t0 });
  await hitRateLimit(store, { key: "booking:b", limit: 3, windowMs: HOUR, now: later(25 * HOUR) });
  assert.deepEqual(rows.map((r) => r.key), ["booking:b"]);
});

test("the client id is hashed, salted and never stored raw", () => {
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
