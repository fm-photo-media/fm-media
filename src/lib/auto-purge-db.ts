import { AUTO_PURGE_KEY, autoPurgeOldInquiries } from "@/lib/auto-purge";
import { prisma } from "@/lib/prisma";

/**
 * Ship condition A1: the automatic retention purge against the real database. Called
 * after each saved booking and on each admin dashboard load; throttled to about once an
 * hour and never throws (see auto-purge.ts).
 */
export async function runAutoPurge() {
  return autoPurgeOldInquiries({
    siteCounter: {
      findUnique: (args) => prisma.siteCounter.findUnique(args),
      create: (args) => prisma.siteCounter.create(args),
      updateMany: (args) => prisma.siteCounter.updateMany(args)
    },
    inquiry: {
      deleteMany: (args) => prisma.inquiry.deleteMany(args)
    }
  }).catch(() => ({ ran: false, deleted: 0 }));
}

/** When the automatic purge last ran, for the admin "Keeping inquiries" panel. */
export async function lastAutoPurgeAt() {
  const row = await prisma.siteCounter
    .findUnique({ where: { key: AUTO_PURGE_KEY }, select: { updatedAt: true } })
    .catch(() => null);
  return row?.updatedAt ?? null;
}
