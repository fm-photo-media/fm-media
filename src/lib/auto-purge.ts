// LEG-1 / batch 4, Ship condition A1: booking inquiries are deleted automatically once
// they are older than the retention period (retention.ts, 24 months by default), so the
// privacy policy's "up to 24 months, then delete them" is true without anyone pressing
// a button. There is no cron job: this runs after each saved booking and on each admin
// dashboard load, at most about once an hour (a SiteCounter row holds the last run).
// Best effort: it never throws, so it can't break a booking or the admin page.

import { monthsBefore, retentionMonthsFrom } from "./retention";

export const AUTO_PURGE_KEY = "inquiry-auto-purge";
export const AUTO_PURGE_INTERVAL_MS = 60 * 60 * 1000;

/** The two Prisma models it touches, kept minimal so tests can use an in-memory fake. */
export type AutoPurgeDb = {
  siteCounter: {
    findUnique(args: { where: { key: string }; select: { updatedAt: true } }): Promise<{ updatedAt: Date } | null>;
    create(args: { data: { key: string; count: number; updatedAt: Date } }): Promise<unknown>;
    updateMany(args: {
      where: { key: string; updatedAt: { lt: Date } };
      data: { count: { increment: number }; updatedAt: Date };
    }): Promise<{ count: number }>;
  };
  inquiry: {
    deleteMany(args: { where: { createdAt: { lt: Date } } }): Promise<{ count: number }>;
  };
};

type Log = Pick<Console, "error" | "info">;
type Options = { now?: Date; env?: Record<string, string | undefined>; log?: Log };
export type AutoPurgeResult = { ran: boolean; deleted: number };

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** Claims this hour's run. Only one caller wins, even when several arrive together. */
async function claimRun(db: AutoPurgeDb, now: Date) {
  const last = await db.siteCounter.findUnique({ where: { key: AUTO_PURGE_KEY }, select: { updatedAt: true } });
  const staleBefore = new Date(now.getTime() - AUTO_PURGE_INTERVAL_MS);

  if (!last) {
    try {
      await db.siteCounter.create({ data: { key: AUTO_PURGE_KEY, count: 1, updatedAt: now } });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false; // another request created it first
      throw error;
    }
  }

  if (last.updatedAt >= staleBefore) return false;

  const { count } = await db.siteCounter.updateMany({
    where: { key: AUTO_PURGE_KEY, updatedAt: { lt: staleBefore } },
    data: { count: { increment: 1 }, updatedAt: now }
  });
  return count === 1;
}

export async function autoPurgeOldInquiries(db: AutoPurgeDb, options: Options = {}): Promise<AutoPurgeResult> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const log = options.log ?? console;

  try {
    if (Number.isNaN(now.getTime())) return { ran: false, deleted: 0 };
    if (!(await claimRun(db, now))) return { ran: false, deleted: 0 };

    const months = retentionMonthsFrom(env);
    const { count } = await db.inquiry.deleteMany({ where: { createdAt: { lt: monthsBefore(now, months) } } });
    if (count > 0) log.info(`[retention] deleted ${count} inquiries received more than ${months} months ago`);
    return { ran: true, deleted: count };
  } catch (error) {
    log.error("[retention] automatic purge of old inquiries failed; will try again later", error);
    return { ran: false, deleted: 0 };
  }
}
