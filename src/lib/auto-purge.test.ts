import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_PURGE_INTERVAL_MS, AUTO_PURGE_KEY, autoPurgeOldInquiries, type AutoPurgeDb } from "./auto-purge";

type Row = { key: string; count: number; updatedAt: Date };

/** An in-memory stand-in for the two Prisma models the purge uses. */
function fakeDb(options: { inquiries?: Date[]; fail?: "find" | "claim" | "delete" } = {}) {
  const counters = new Map<string, Row>();
  let inquiries = [...(options.inquiries ?? [])];
  const calls = { deleteMany: 0, cutoffs: [] as Date[] };

  const db: AutoPurgeDb = {
    siteCounter: {
      async findUnique({ where }) {
        if (options.fail === "find") throw new Error("db down");
        const row = counters.get(where.key);
        return row ? { updatedAt: row.updatedAt } : null;
      },
      async create({ data }) {
        if (options.fail === "claim") throw new Error("db down");
        if (counters.has(data.key)) throw Object.assign(new Error("unique"), { code: "P2002" });
        counters.set(data.key, { key: data.key, count: data.count, updatedAt: data.updatedAt });
        return {};
      },
      async updateMany({ where, data }) {
        if (options.fail === "claim") throw new Error("db down");
        const row = counters.get(where.key);
        if (!row || !(row.updatedAt < where.updatedAt.lt)) return { count: 0 };
        row.count += data.count.increment;
        row.updatedAt = data.updatedAt;
        return { count: 1 };
      }
    },
    inquiry: {
      async deleteMany({ where }) {
        if (options.fail === "delete") throw new Error("db down");
        calls.deleteMany++;
        calls.cutoffs.push(where.createdAt.lt);
        const before = inquiries.length;
        inquiries = inquiries.filter((createdAt) => !(createdAt < where.createdAt.lt));
        return { count: before - inquiries.length };
      }
    }
  };

  return { db, counters, calls, remaining: () => inquiries };
}

const quiet = { warn: () => {}, error: () => {}, info: () => {} };
const now = new Date("2027-01-14T16:00:00Z");

test("A1: deletes inquiries received more than 24 months ago, and keeps newer ones", async () => {
  const old = new Date("2025-01-14T15:59:59Z");
  const edge = new Date("2025-01-14T16:00:00Z");
  const recent = new Date("2026-12-01T00:00:00Z");
  const { db, calls, remaining } = fakeDb({ inquiries: [old, edge, recent] });

  const result = await autoPurgeOldInquiries(db, { now, env: {}, log: quiet });

  assert.deepEqual(result, { ran: true, deleted: 1 });
  assert.equal(calls.cutoffs[0].toISOString(), "2025-01-14T16:00:00.000Z");
  assert.deepEqual(remaining(), [edge, recent]);
});

test("A1: uses INQUIRY_RETENTION_MONTHS when it is set (same rule as the manual purge)", async () => {
  const { db, calls } = fakeDb({ inquiries: [new Date("2026-06-01T00:00:00Z")] });
  const result = await autoPurgeOldInquiries(db, { now, env: { INQUIRY_RETENTION_MONTHS: "6" }, log: quiet });
  assert.deepEqual(result, { ran: true, deleted: 1 });
  assert.equal(calls.cutoffs[0].toISOString(), "2026-07-14T16:00:00.000Z");
});

test("A1: runs at most about once an hour (SiteCounter timestamp)", async () => {
  assert.equal(AUTO_PURGE_INTERVAL_MS, 60 * 60 * 1000);
  const { db, calls, counters } = fakeDb();
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60 * 1000);

  assert.equal((await autoPurgeOldInquiries(db, { now: at(0), env: {}, log: quiet })).ran, true);
  assert.equal((await autoPurgeOldInquiries(db, { now: at(1), env: {}, log: quiet })).ran, false);
  assert.equal((await autoPurgeOldInquiries(db, { now: at(59), env: {}, log: quiet })).ran, false);
  assert.equal((await autoPurgeOldInquiries(db, { now: at(61), env: {}, log: quiet })).ran, true);
  assert.equal(calls.deleteMany, 2);
  assert.equal(counters.get(AUTO_PURGE_KEY)?.count, 2);
});

test("A1: two requests at the same moment purge once (the claim is atomic)", async () => {
  const { db, calls } = fakeDb();
  const results = await Promise.all([1, 2, 3].map(() => autoPurgeOldInquiries(db, { now, env: {}, log: quiet })));
  assert.equal(results.filter((r) => r.ran).length, 1);
  assert.equal(calls.deleteMany, 1);
});

test("A1: best effort. A database error never throws, so a booking or the admin page can't break", async () => {
  for (const fail of ["find", "claim", "delete"] as const) {
    const errors: unknown[] = [];
    const { db } = fakeDb({ fail, inquiries: [new Date("2020-01-01T00:00:00Z")] });
    const result = await autoPurgeOldInquiries(db, { now, env: {}, log: { ...quiet, error: (...args) => errors.push(args) } });
    assert.equal(result.ran, false, fail);
    assert.equal(errors.length, 1, `${fail} is logged`);
  }
});

test("A1: a bad clock value doesn't delete anything", async () => {
  const { db, calls } = fakeDb({ inquiries: [new Date("2020-01-01T00:00:00Z")] });
  const result = await autoPurgeOldInquiries(db, { now: new Date("not a date"), env: {}, log: quiet });
  assert.equal(result.ran, false);
  assert.equal(calls.deleteMany, 0);
});
