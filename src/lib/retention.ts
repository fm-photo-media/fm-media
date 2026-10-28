// SEC-13 / LEG-1 (legal.md LEG-6): how long booking inquiries are kept, and the admin
// paging that makes every inquiry reachable. Old inquiries are deleted automatically
// (auto-purge.ts, Ship condition A1, no cron) and can also be purged by hand from /admin.

export const DEFAULT_RETENTION_MONTHS = 24;
export const MAX_RETENTION_MONTHS = 120;
export const INQUIRIES_PER_PAGE = 20;

type Env = Record<string, string | undefined>;

export function parseMonths(value: unknown) {
  if (typeof value !== "string" || !/^\s*\d+\s*$/.test(value)) return null;
  const months = Number(value.trim());
  return months >= 1 && months <= MAX_RETENTION_MONTHS ? months : null;
}

/** INQUIRY_RETENTION_MONTHS (whole months, 1 to 120), else 24. */
export function retentionMonthsFrom(env: Env) {
  return parseMonths(env.INQUIRY_RETENTION_MONTHS) ?? DEFAULT_RETENTION_MONTHS;
}

/** The same instant `months` calendar months earlier, clamping the day (Mar 31 -> Feb 28/29). */
export function monthsBefore(now: Date, months: number) {
  const result = new Date(now.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function inquiryPage(rawPage: string | undefined, total: number) {
  const pageCount = Math.max(1, Math.ceil(total / INQUIRIES_PER_PAGE));
  const requested = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.min(Math.max(1, requested), pageCount);
  return { page, pageCount, skip: (page - 1) * INQUIRIES_PER_PAGE, take: INQUIRIES_PER_PAGE };
}

// Admin filter for the inquiry list.
export const INQUIRY_FILTERS = {
  all: "All",
  NEW: "New",
  CONTACTED: "Contacted",
  "email-issue": "Email not sent"
} as const;
export type InquiryFilter = keyof typeof INQUIRY_FILTERS;

// Email states that mean the owner was never notified, so the row needs a follow-up.
export const EMAIL_ISSUE_STATUSES = ["FAILED", "SKIPPED_CAP"] as const;

export function inquiryFilterFrom(value: string | undefined): InquiryFilter {
  return value && Object.hasOwn(INQUIRY_FILTERS, value) ? (value as InquiryFilter) : "all";
}
