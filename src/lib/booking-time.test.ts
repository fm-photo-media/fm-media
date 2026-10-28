import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBookingSlot, chicagoToday, chicagoWallClock, chicagoWallTimeToInstant, formatStoredDate, storedDateFromInput } from "./booking-time";

// QA-3: every rule runs in America/Chicago, whatever the server's TZ is.
const at = (iso: string) => new Date(iso);

test("chicagoToday uses the Chicago calendar date, not UTC", () => {
  // 19:00 CST on Jan 14 is already Jan 15 in UTC.
  assert.equal(chicagoToday(at("2027-01-15T01:00:00Z")), "2027-01-14");
  assert.equal(chicagoToday(at("2027-01-15T06:30:00Z")), "2027-01-15");
});

test("wall time converts with the right offset in winter and summer", () => {
  assert.equal(chicagoWallTimeToInstant("2027-01-14", "12:00").toISOString(), "2027-01-14T18:00:00.000Z"); // CST -6
  assert.equal(chicagoWallTimeToInstant("2027-07-14", "12:00").toISOString(), "2027-07-14T17:00:00.000Z"); // CDT -5
  assert.deepEqual(chicagoWallClock(at("2027-07-14T17:00:00Z")), { date: "2027-07-14", time: "12:00" });
});

// The QA-4 table (now 10:00 CST = 16:00Z on 2027-01-14).
const tenAm = at("2027-01-14T16:00:00Z");

test("same day: 2h and 6h out are accepted, 1h out is rejected", () => {
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "12:00", window: "Flexible", now: tenAm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "16:00", window: "Flexible", now: tenAm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "11:00", window: "Flexible", now: tenAm })?.field, "preferredTime");
});

test("exactly 90 minutes out is accepted, 89 is rejected", () => {
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "11:30", window: "Flexible", now: tenAm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "11:29", window: "Flexible", now: tenAm })?.field, "preferredTime");
});

test("7 PM CST (already tomorrow in UTC): today at 9 PM is still bookable", () => {
  const sevenPm = at("2027-01-15T01:00:00Z");
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "21:00", window: "Flexible", now: sevenPm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-13", time: "21:00", window: "Flexible", now: sevenPm })?.field, "preferredDate");
});

test("11:30 PM CST: tomorrow at 00:30 is under 90 minutes and rejected", () => {
  const lateNight = at("2027-01-15T05:30:00Z");
  assert.equal(checkBookingSlot({ date: "2027-01-15", time: "00:30", window: "Flexible", now: lateNight })?.field, "preferredTime");
  assert.equal(checkBookingSlot({ date: "2027-01-15", time: "01:00", window: "Flexible", now: lateNight }), null);
});

test("DST spring forward (2027-03-14, 2 AM jumps to 3 AM)", () => {
  const now = at("2027-03-14T07:30:00Z"); // 01:30 CST
  assert.equal(checkBookingSlot({ date: "2027-03-14", time: "03:30", window: "Flexible", now })?.field, "preferredTime"); // 60 real minutes
  assert.equal(checkBookingSlot({ date: "2027-03-14", time: "04:00", window: "Flexible", now }), null); // 90 real minutes
  assert.equal(chicagoWallTimeToInstant("2027-03-14", "04:00").toISOString(), "2027-03-14T09:00:00.000Z");
});

test("DST fall back (2027-11-07, 1 AM happens twice)", () => {
  const now = at("2027-11-07T06:30:00Z"); // 01:30 CDT, the first 1:30
  // 01:45 is read as its first (earlier) occurrence, so it is too soon.
  assert.equal(checkBookingSlot({ date: "2027-11-07", time: "01:45", window: "Flexible", now })?.field, "preferredTime");
  assert.equal(chicagoWallTimeToInstant("2027-11-07", "02:30").toISOString(), "2027-11-07T08:30:00.000Z"); // CST
  assert.equal(checkBookingSlot({ date: "2027-11-07", time: "02:30", window: "Flexible", now }), null); // 120 real minutes
});

test("no exact time: a same-day window that has passed is rejected", () => {
  const onePm = at("2027-01-14T19:00:00Z");
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "", window: "Morning", now: onePm })?.field, "preferredWindow");
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "", window: "Afternoon", now: onePm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "", window: "Flexible", now: onePm }), null);
  assert.equal(checkBookingSlot({ date: "2027-01-15", time: "", window: "Morning", now: onePm }), null);
});

test("no exact time, Flexible, too late in the day for today", () => {
  const elevenPm = at("2027-01-15T05:00:00Z"); // 23:00 CST
  assert.equal(checkBookingSlot({ date: "2027-01-14", time: "", window: "Flexible", now: elevenPm })?.field, "preferredDate");
});

test("impossible or malformed dates are rejected", () => {
  assert.equal(checkBookingSlot({ date: "2027-02-30", time: "", window: "Flexible", now: tenAm })?.field, "preferredDate");
  assert.equal(checkBookingSlot({ date: "", time: "", window: "Flexible", now: tenAm })?.field, "preferredDate");
});

test("the stored date is the calendar day at UTC midnight and formats back to the same day", () => {
  const stored = storedDateFromInput("2027-01-14");
  assert.equal(stored.toISOString(), "2027-01-14T00:00:00.000Z");
  assert.equal(formatStoredDate(stored), "Thu, Jan 14, 2027");
});
