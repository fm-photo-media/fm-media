// Batch 5b: the admin screens' computed lines (design.md "Admin build spec", notes 4-7).
// Pure functions, tested in admin-view.test.ts. Every count comes from real rows.

import { BOOKING_TIME_ZONE, chicagoToday } from "./booking-time";
import { shootCaption } from "./portfolio";
import { displayPrice } from "./price-menu";

export function countLabel(n: number, noun: string, plural = `${noun}s`) {
  return `${n} ${n === 1 ? noun : plural}`;
}

/** Requests: the finding under the h1 (the screen's one question). */
export function requestsLead({ total, newCount }: { total: number; newCount: number }) {
  if (total === 0) return "No requests yet. New booking requests show up here.";
  if (newCount === 0) return "Nothing new waiting for a reply.";
  return `${countLabel(newCount, "new request", "new requests")} waiting for a reply.`;
}

export type CallBack = { name: string; phone: string };

/**
 * New requests whose notification email never reached the owner (FAILED or over the
 * daily cap). One is named with its number; several point at the top of the list.
 */
export function callBackSummary(rows: CallBack[]) {
  if (rows.length === 0) return null;
  return {
    label: `${countLabel(rows.length, "notification")} failed:`,
    one: rows.length === 1 ? { name: rows[0].name, phone: rows[0].phone } : null
  };
}

/** A stored "HH:MM" start time as "2:30 PM"; "" for "Flexible" or anything else. */
export function clockLabel(value: string | null | undefined) {
  const match = value ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value) : null;
  if (!match) return "";
  const hour = Number(match[1]);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** DES-43: a stored home size with its unit ("1650" → "1,650 sq ft"); null when none was given. */
export function sqftLabel(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text || /^(none|not provided)$/i.test(text)) return null;
  const digits = text.replace(/,/g, "");
  return /^\d+$/.test(digits) ? `${Number(digits).toLocaleString("en-US")} sq ft` : text;
}

/** DES-46: "1–21 of 24, newest first", counting the pinned call-back rows shown on page 1. */
export function pagerLabel({ pinned, skip, shown, total }: { pinned: number; skip: number; shown: number; total: number }) {
  const first = skip === 0 ? 1 : pinned + skip + 1;
  const last = skip === 0 ? pinned + shown : pinned + skip + shown;
  return `${first}–${last} of ${total}, newest first`;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIME_ZONE, month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", { timeZone: BOOKING_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });

const isoDayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

/** "Today 9:05 AM", "Yesterday …", "Oct 20 …", or with the year when it isn't this year. Chicago time. */
export function receivedLabel(at: Date, now: Date) {
  const atDay = dayKey.format(at);
  const today = dayKey.format(now);
  const diff = isoDayNumber(today) - isoDayNumber(atDay);
  const time = timeFormat.format(at).replace(/ /g, " ");
  const day =
    diff === 0 ? "Today" : diff === 1 ? "Yesterday" : atDay.slice(0, 4) === today.slice(0, 4) ? shortDate.format(at) : longDate.format(at);
  return { day, time };
}

const storedDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const storedDayYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** A stored booking day (UTC midnight) as "Fri, Oct 30", with the year only when it isn't this year. */
export function shootDayLabel(day: Date, now: Date) {
  return day.getUTCFullYear() === Number(chicagoToday(now).slice(0, 4)) ? storedDay.format(day) : storedDayYear.format(day);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The "Requested shoot days" strip: `count` calendar days from today in Chicago. */
export function shootDays(now: Date, count: number) {
  const start = chicagoToday(now);
  const base = isoDayNumber(start);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date((base + i) * 86400000);
    const weekday = date.getUTCDay();
    return {
      iso: date.toISOString().slice(0, 10),
      weekday: WEEKDAYS[weekday],
      day: date.getUTCDate(),
      weekend: weekday === 0 || weekday === 6,
      today: i === 0
    };
  });
}

// The gallery's categories (the admin mockup's four), plus any already in use.
export const GALLERY_CATEGORIES = ["Exterior", "Interior", "Drone", "Floor plan"];

export function galleryCategories(inUse: string[]) {
  return Array.from(new Set([...GALLERY_CATEGORIES, ...inUse.filter(Boolean)]));
}

export function gallerySummary({ total, onSite, featured }: { total: number; onSite: number; featured: number }) {
  if (total === 0) return "No photos yet. Upload one from your own shoots.";
  return `${countLabel(total, "photo")}, ${onSite} on the site, ${featured} featured on the home page.`;
}

// Batch 6 (DES-48, and the services option from the 5b re-check): the grey second line of a
// phone row. The state is printed only when it's the exception, so "Hidden" shows and
// "Published" doesn't (app-screens 13: grey for what's fine, a mark only on what isn't).
export function galleryPhoneLine({
  shoot,
  town,
  category,
  live
}: {
  shoot: string | null;
  town: string | null;
  category: string;
  live: boolean;
}) {
  return [shootCaption(shoot, town), category, live ? null : "Hidden"].filter(Boolean).join(" · ");
}

export function servicePhoneLine({
  squareFeet,
  deliverable,
  published
}: {
  squareFeet: string | null;
  deliverable: string;
  published: boolean;
}) {
  return [squareFeet, deliverable, published ? null : "Hidden"].filter(Boolean).join(" · ");
}

export function servicesSummary({ total, published }: { total: number; published: number }) {
  return `${countLabel(total, "service")}, ${published} on the site.`;
}

type PreviewService = {
  title: string;
  squareFeet: string | null;
  deliverable: string;
  priceLabel: string | null;
  startingAt: number;
};

/** The services editor's "On the site it reads" line. */
export function servicePreview(service: PreviewService) {
  return [service.title, service.squareFeet, service.deliverable, displayPrice(service)]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}
