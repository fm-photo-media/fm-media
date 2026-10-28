// QA-3: booking dates and times are Chicagoland wall-clock times (America/Chicago),
// never the server's TZ (UTC on Vercel). Pure functions, safe on server and client.

export const BOOKING_TIME_ZONE = "America/Chicago";
export const MIN_LEAD_MINUTES = 90;

export const TIME_WINDOWS = ["Morning", "Midday", "Afternoon", "Flexible"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

// Internal cut-offs for same-day checks only (not shown to customers):
// a window still counts for today if it ends at least 90 minutes from now.
const WINDOW_END: Record<TimeWindow, string> = {
  Morning: "12:00",
  Midday: "14:00",
  Afternoon: "17:00",
  Flexible: "23:59"
};

// QA-20: what each window means when the customer also types an exact start time
// ([start, end), Chicago wall clock). An exact time outside the chosen window turns the
// window into Flexible, so the owner never sees "Morning at 16:00".
const WINDOW_RANGE: Record<Exclude<TimeWindow, "Flexible">, [string, string]> = {
  Morning: ["00:00", "12:00"],
  Midday: ["12:00", "14:00"],
  Afternoon: ["14:00", "17:00"]
};

export function timeFitsWindow(time: string, window: TimeWindow) {
  if (window === "Flexible") return true;
  const [start, end] = WINDOW_RANGE[window];
  return time >= start && time < end;
}

/** The window to store: Flexible when an exact time falls outside the chosen one. */
export function windowForTime(time: string, window: TimeWindow): TimeWindow {
  return time && isValidTimeInput(time) && !timeFitsWindow(time, window) ? "Flexible" : window;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const chicagoParts = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function partsAt(instant: number) {
  const parts: Record<string, string> = {};
  for (const part of chicagoParts.formatToParts(new Date(instant))) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

// Chicago's UTC offset (ms) at a given instant, e.g. -6h in winter.
function offsetAt(instant: number) {
  const p = partsAt(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar date in Chicago at `now`, as YYYY-MM-DD. */
export function chicagoToday(now: Date) {
  return chicagoWallClock(now).date;
}

/** The Chicago wall-clock date and HH:MM at an instant. */
export function chicagoWallClock(instant: Date) {
  const p = partsAt(instant.getTime());
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function isValidDateInput(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTimeInput(value: string) {
  return TIME_RE.test(value);
}

/**
 * The instant of a Chicago wall-clock time. An ambiguous fall-back time resolves to
 * its first (earlier) occurrence; a skipped spring-forward time resolves to the
 * hour before the jump. Both err on the side of "too soon", which is the safe side.
 */
export function chicagoWallTimeToInstant(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  const firstOffset = offsetAt(wallAsUtc);
  let instant = wallAsUtc - firstOffset;
  const secondOffset = offsetAt(instant);
  if (secondOffset !== firstOffset) instant = wallAsUtc - secondOffset;
  return new Date(instant);
}

/** Bookings store the calendar day at UTC midnight (as existing rows do). */
export function storedDateFromInput(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Formats a stored booking date as the same calendar day on any server. */
export function formatStoredDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export type SlotError = { field: "preferredDate" | "preferredTime" | "preferredWindow"; message: string };

export function checkBookingSlot({
  date,
  time,
  window,
  now
}: {
  date: string;
  time: string;
  window: TimeWindow;
  now: Date;
}): SlotError | null {
  if (!isValidDateInput(date)) {
    return { field: "preferredDate", message: "Choose a date." };
  }

  const today = chicagoToday(now);
  if (date < today) {
    return { field: "preferredDate", message: "Choose today or a future date." };
  }

  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60 * 1000;

  if (time && !isValidTimeInput(time)) {
    return { field: "preferredTime", message: "Choose a time like 09:30, or leave it blank." };
  }

  if (time) {
    if (chicagoWallTimeToInstant(date, time).getTime() < earliest) {
      return { field: "preferredTime", message: "Choose a time at least 90 minutes from now." };
    }
    return null;
  }

  if (date === today && chicagoWallTimeToInstant(date, WINDOW_END[window]).getTime() < earliest) {
    return window === "Flexible"
      ? { field: "preferredDate", message: "It's too late to book today. Choose another day." }
      : { field: "preferredWindow", message: "That window has passed for today. Pick a later window or another day." };
  }

  return null;
}
