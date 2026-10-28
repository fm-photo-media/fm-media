import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callBackSummary,
  clockLabel,
  countLabel,
  pagerLabel,
  sqftLabel,
  gallerySummary,
  receivedLabel,
  requestsLead,
  shootDayLabel,
  servicePreview,
  servicesSummary,
  shootDays,
  telHref
} from "./admin-view";
import { imageDimensions } from "./upload";
import { RATE_LIMITS, wrongPasswordMessage } from "./rate-limit";
import { galleryImageSchema } from "./validation";

// ---------------------------------------------------------------- Requests (batch 5b)

test("5b: the Requests finding is computed from the rows", () => {
  assert.equal(requestsLead({ total: 0, newCount: 0 }), "No requests yet. New booking requests show up here.");
  assert.equal(requestsLead({ total: 4, newCount: 0 }), "Nothing new waiting for a reply.");
  assert.equal(requestsLead({ total: 8, newCount: 1 }), "1 new request waiting for a reply.");
  assert.equal(requestsLead({ total: 8, newCount: 3 }), "3 new requests waiting for a reply.");
});

test("5b: failed notifications name the person and number when there is one", () => {
  assert.equal(callBackSummary([]), null);
  assert.deepEqual(callBackSummary([{ name: "Dana Okafor", phone: "(773) 555-0142" }]), {
    label: "1 notification failed:",
    one: { name: "Dana Okafor", phone: "(773) 555-0142" }
  });
  assert.deepEqual(
    callBackSummary([
      { name: "A", phone: "1" },
      { name: "B", phone: "2" }
    ]),
    { label: "2 notifications failed:", one: null }
  );
});

test("5b: an exact start time reads as a 12-hour clock", () => {
  assert.equal(clockLabel("14:30"), "2:30 PM");
  assert.equal(clockLabel("09:00"), "9:00 AM");
  assert.equal(clockLabel("00:15"), "12:15 AM");
  assert.equal(clockLabel("12:00"), "12:00 PM");
  assert.equal(clockLabel("Flexible"), "");
  assert.equal(clockLabel(""), "");
});

test("5b fix 1 / DES-43: sq ft always carries its unit, never a bare number", () => {
  assert.equal(sqftLabel("1650"), "1,650 sq ft");
  assert.equal(sqftLabel("1,650"), "1,650 sq ft");
  assert.equal(sqftLabel("1,650 sq ft"), "1,650 sq ft");
  assert.equal(sqftLabel("About 2000 sq ft"), "About 2000 sq ft");
  assert.equal(sqftLabel("Not provided"), null);
  assert.equal(sqftLabel(""), null);
});

test("5b fix 1 / DES-46: the pager counts the pinned rows, so its total matches the finding", () => {
  assert.equal(pagerLabel({ pinned: 1, skip: 0, shown: 20, total: 24 }), "1–21 of 24, newest first");
  assert.equal(pagerLabel({ pinned: 1, skip: 20, shown: 3, total: 24 }), "22–24 of 24, newest first");
  assert.equal(pagerLabel({ pinned: 0, skip: 0, shown: 8, total: 8 }), "1–8 of 8, newest first");
  assert.equal(pagerLabel({ pinned: 2, skip: 0, shown: 0, total: 2 }), "1–2 of 2, newest first");
});

test("5b: tel links keep digits and a leading plus only", () => {
  assert.equal(telHref("(773) 555-0142"), "tel:7735550142");
  assert.equal(telHref("+1 312.555.0100"), "tel:+13125550100");
});

test("5b: received times read as Today / Yesterday / a date, in Chicago time", () => {
  const now = new Date("2026-10-28T20:00:00Z"); // 3:00 PM in Chicago
  assert.deepEqual(receivedLabel(new Date("2026-10-28T14:05:00Z"), now), { day: "Today", time: "9:05 AM" });
  assert.deepEqual(receivedLabel(new Date("2026-10-28T03:30:00Z"), now), { day: "Yesterday", time: "10:30 PM" });
  assert.deepEqual(receivedLabel(new Date("2026-10-20T17:00:00Z"), now), { day: "Oct 20", time: "12:00 PM" });
  assert.deepEqual(receivedLabel(new Date("2025-12-01T17:00:00Z"), now), { day: "Dec 1, 2025", time: "11:00 AM" });
});

test("5b: a preferred shoot day drops the year when it is this year", () => {
  const now = new Date("2026-10-28T20:00:00Z");
  assert.equal(shootDayLabel(new Date("2026-10-30T00:00:00Z"), now), "Fri, Oct 30");
  assert.equal(shootDayLabel(new Date("2027-01-04T00:00:00Z"), now), "Mon, Jan 4, 2027");
});

test("5b: the shoot-day strip starts today (Chicago) and marks weekends", () => {
  const days = shootDays(new Date("2026-10-29T03:00:00Z"), 14); // still Oct 28 in Chicago
  assert.equal(days.length, 14);
  assert.deepEqual(days[0], { iso: "2026-10-28", weekday: "Wed", day: 28, weekend: false, today: true });
  assert.equal(days[3].iso, "2026-10-31");
  assert.equal(days[3].weekend, true);
  assert.equal(days[4].weekend, true);
  assert.equal(days[13].iso, "2026-11-10");
  assert.equal(days.filter((d) => d.today).length, 1);
});

test("5b: counts are worded with the right plural", () => {
  assert.equal(countLabel(0, "photo"), "0 photos");
  assert.equal(countLabel(1, "photo"), "1 photo");
  assert.equal(countLabel(2, "service"), "2 services");
});

// ---------------------------------------------------------------- Gallery and services

test("5b: the gallery subline counts photos, the ones on the site, and featured", () => {
  assert.equal(gallerySummary({ total: 0, onSite: 0, featured: 0 }), "No photos yet. Upload one from your own shoots.");
  assert.equal(gallerySummary({ total: 7, onSite: 5, featured: 2 }), "7 photos, 5 on the site, 2 featured on the home page.");
  assert.equal(gallerySummary({ total: 1, onSite: 1, featured: 1 }), "1 photo, 1 on the site, 1 featured on the home page.");
});

test("5b: the services subline counts services and the published ones", () => {
  assert.equal(servicesSummary({ total: 10, published: 9 }), "10 services, 9 on the site.");
  assert.equal(servicesSummary({ total: 1, published: 0 }), "1 service, 0 on the site.");
});

test("5b: the 'On the site it reads' preview uses the site's price wording", () => {
  assert.equal(
    servicePreview({ title: "Basic", squareFeet: "Up to 1,500 sq ft", deliverable: "25 edited photos", priceLabel: "$100", startingAt: 100 }),
    "Basic · Up to 1,500 sq ft · 25 edited photos · $100"
  );
  assert.equal(
    servicePreview({ title: "Drone Photos", squareFeet: null, deliverable: "", priceLabel: null, startingAt: 75 }),
    "Drone Photos · $75"
  );
});

// ---------------------------------------------------------------- Login copy (SEC-3)

test("5b / SEC-3: the wrong-password line is built from the throttle's own constants", () => {
  assert.equal(wrongPasswordMessage(), "That password didn't work. After 5 tries, sign-in pauses for 15 minutes.");
  const [first] = RATE_LIMITS.login.windows;
  assert.match(wrongPasswordMessage(), new RegExp(`After ${first.limit} tries`));
  // If the limit changes, the copy follows it.
  assert.equal(
    wrongPasswordMessage([{ limit: 3, windowMs: 60 * 60 * 1000 }]),
    "That password didn't work. After 3 tries, sign-in pauses for 1 hour."
  );
});

// ---------------------------------------------------------------- Image size (note 7)

const repo = process.cwd();
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (s: string) => s.split("").map((c) => c.charCodeAt(0));

test("5b: width and height are read from real JPEG and PNG files", () => {
  const jpeg = new Uint8Array(readFileSync(path.join(repo, "public/images/portfolio/real-estate-photo-02.jpg")));
  assert.deepEqual(imageDimensions(jpeg), { width: 2000, height: 1335 });
  const png = new Uint8Array(readFileSync(path.join(repo, "public/brand/logo-mark.png")));
  assert.deepEqual(imageDimensions(png), { width: 564, height: 377 });
});

test("5b: a JPEG rotated by its EXIF orientation reports its upright size", () => {
  // SOI, APP1 Exif (big-endian TIFF, one IFD0 entry: Orientation = 6), SOF0 600x400.
  const tiff = [...ascii("MM"), 0, 42, ...u32be(8), ...u16be(1), ...u16be(0x0112), ...u16be(3), ...u32be(1), ...u16be(6), 0, 0, ...u32be(0)];
  const app1 = [...ascii("Exif"), 0, 0, ...tiff];
  const sof = [8, ...u16be(400), ...u16be(600), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, ...u16be(app1.length + 2), ...app1,
    0xff, 0xc0, ...u16be(sof.length + 2), ...sof,
    0xff, 0xd9
  ]);
  assert.deepEqual(imageDimensions(bytes), { width: 400, height: 600 });
});

test("5b: WebP (lossy, lossless, extended) and AVIF sizes are read from their headers", () => {
  const vp8 = new Uint8Array(30);
  vp8.set(ascii("RIFF"), 0);
  vp8.set(ascii("WEBPVP8 "), 8);
  vp8.set([0x9d, 0x01, 0x2a], 23);
  vp8.set([0x20, 0x03, 0x58, 0x02], 26); // 800 x 600
  assert.deepEqual(imageDimensions(vp8), { width: 800, height: 600 });

  const vp8l = new Uint8Array(30);
  vp8l.set(ascii("RIFF"), 0);
  vp8l.set(ascii("WEBPVP8L"), 8);
  vp8l[20] = 0x2f;
  // width-1 = 1023 (14 bits), height-1 = 767 (14 bits), little-endian bit stream
  const bits = 1023 | (767 << 14);
  vp8l.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff], 21);
  assert.deepEqual(imageDimensions(vp8l), { width: 1024, height: 768 });

  const vp8x = new Uint8Array(30);
  vp8x.set(ascii("RIFF"), 0);
  vp8x.set(ascii("WEBPVP8X"), 8);
  vp8x.set([0x3f, 0x17, 0x00], 24); // width - 1, 24-bit little-endian
  vp8x.set([0x9f, 0x0f, 0x00], 27); // height - 1 = 3999
  assert.deepEqual(imageDimensions(vp8x), { width: 0x173f + 1, height: 4000 });

  const avif = new Uint8Array([
    0, 0, 0, 0x1c, ...ascii("ftypavif"), 0, 0, 0, 0, ...ascii("avifmif1miaf"),
    0, 0, 0, 0x14, ...ascii("ispe"), 0, 0, 0, 0, ...u32be(3000), ...u32be(2000)
  ]);
  assert.deepEqual(imageDimensions(avif), { width: 3000, height: 2000 });
});

test("5b: anything that isn't a readable image gives null", () => {
  assert.equal(imageDimensions(new Uint8Array(0)), null);
  assert.equal(imageDimensions(new Uint8Array(ascii("<svg xmlns='http://www.w3.org/2000/svg'>"))), null);
  assert.equal(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])), null, "a truncated JPEG");
});

// ---------------------------------------------------------------- DES-15 (alt text)

test("DES-15: a photo can be saved without alt text, but never published without it", () => {
  const base = { title: "Front", category: "Exterior", imageUrl: "/images/shoots/naperville-01.jpg" };
  assert.equal(galleryImageSchema.safeParse({ ...base, alt: "", published: false }).success, true);
  const refused = galleryImageSchema.safeParse({ ...base, alt: "  ", published: true });
  assert.equal(refused.success, false);
  assert.deepEqual(refused.error?.issues.map((issue) => issue.path[0]), ["alt"]);
  assert.equal(galleryImageSchema.safeParse({ ...base, alt: "Short", published: false }).success, false, "too short to be useful");
  assert.equal(galleryImageSchema.safeParse({ ...base, alt: "Front exterior of a home", published: true }).success, true);
});
