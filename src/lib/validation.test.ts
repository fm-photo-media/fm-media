import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_PHOTO_PACKAGE, makeInquirySchema, serviceSchema, type BookingOptions } from "./validation";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

// Fixed clock: 10:00 CST on Thu 2027-01-14.
const now = () => new Date("2027-01-14T16:00:00Z");

// QA-2: the options come from the published Service rows (see booking-options.ts).
const options: BookingOptions = {
  photoPackages: [
    { value: "basic", label: "Basic - $120" },
    { value: "standard", label: "Standard - $135" }
  ],
  addOns: [
    { value: "drone-photos", label: "Drone Photos - $75" },
    { value: "floor-plans", label: "Floor Plans - $50" }
  ],
  videoServices: [{ value: "basic-walkthrough", label: "Basic Walkthrough - $150" }]
};

const schema = makeInquirySchema({ options, now });

const base = {
  name: "Test Agent",
  email: "agent@example.com",
  phone: "312-555-0100",
  propertyAddress: "123 Main St, Chicago",
  photoPackage: "basic",
  addOns: "",
  videoService: "",
  preferredDate: "2027-01-15",
  preferredTime: "",
  preferredWindow: "Morning",
  message: "Two-story home, vacant."
};

function parse(overrides: Record<string, unknown> = {}) {
  return schema.safeParse({ ...base, ...overrides });
}

function fieldErrors(overrides: Record<string, unknown>) {
  const parsed = parse(overrides);
  assert.equal(parsed.success, false, "expected a validation error");
  return parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
}

function ok(overrides: Record<string, unknown> = {}) {
  const parsed = parse(overrides);
  assert.ok(parsed.success, JSON.stringify(!parsed.success && parsed.error.issues));
  return parsed.data;
}

test("a ticked checkbox ('on') and boolean true save the first-shoot offer", () => {
  assert.equal(ok({ firstShootOffer: "on" }).firstShootOffer, true);
  assert.equal(ok({ firstShootOffer: true }).firstShootOffer, true);
});

test("anything else saves false, including the strings 'false' and 'true'", () => {
  for (const value of [undefined, null, false, "false", "true", "1", ""]) {
    assert.equal(ok({ firstShootOffer: value }).firstShootOffer, false, String(value));
  }
});

test("QA-17: the offer needs a photo package", () => {
  const errors = fieldErrors({ photoPackage: "", addOns: "floor-plans", firstShootOffer: "on" });
  assert.match(errors.firstShootOffer, /photo package/i);
  assert.equal(ok({ photoPackage: "standard", firstShootOffer: "on" }).firstShootOffer, true);
});

test("QA-2: options map to the DB labels, and unknown or stale options are refused", () => {
  const data = ok({ photoPackage: "basic", addOns: "drone-photos,floor-plans", videoService: "basic-walkthrough" });
  assert.equal(data.photoPackage, "Basic - $120");
  assert.equal(data.addOns, "Drone Photos - $75, Floor Plans - $50");
  assert.equal(data.videoService, "Basic Walkthrough - $150");
  assert.ok(fieldErrors({ photoPackage: "Basic - $100" }).photoPackage);
  assert.ok(fieldErrors({ addOns: "floor-plans,luxury-yacht" }).addOns);
  assert.ok(fieldErrors({ videoService: "cinematic-video" }).videoService);
});

test("no package, add-on or video is refused", () => {
  assert.ok(fieldErrors({ photoPackage: "" }).services);
  const data = ok({ photoPackage: "", addOns: "floor-plans" });
  assert.equal(data.photoPackage, "No photo package selected");
  assert.equal(data.videoService, "None");
});

test("SEC-4 / QA-9: every free-text field has a length cap", () => {
  const long = (n: number) => "a".repeat(n);
  assert.ok(fieldErrors({ name: long(121) }).name);
  assert.ok(fieldErrors({ email: `${long(250)}@example.com` }).email);
  assert.ok(fieldErrors({ phone: "3".repeat(31) }).phone);
  assert.ok(fieldErrors({ agencyName: long(161) }).agencyName);
  assert.ok(fieldErrors({ propertyAddress: long(301) }).propertyAddress);
  assert.ok(fieldErrors({ message: long(4001) }).message);
  assert.ok(fieldErrors({ squareFeet: long(21) }).squareFeet);
  assert.equal(ok({ name: long(120), message: long(4000) }).name.length, 120);
});

test("research: approx. sq ft is optional and stored readably", () => {
  assert.equal(ok().propertySize, "Not provided");
  assert.equal(ok({ squareFeet: "1,850" }).propertySize, "1,850 sq ft");
  assert.equal(ok({ squareFeet: " 2400 " }).propertySize, "2,400 sq ft");
  assert.ok(fieldErrors({ squareFeet: "big" }).squareFeet);
  assert.ok(fieldErrors({ squareFeet: "12" }).squareFeet);
});

test("research: the time window replaces the required clock time", () => {
  const data = ok({ preferredTime: "", preferredWindow: "Afternoon" });
  assert.equal(data.preferredWindow, "Afternoon");
  assert.equal(data.preferredTime, "Flexible");
  assert.equal(ok({ preferredWindow: undefined }).preferredWindow, "Flexible");
  assert.equal(ok({ preferredTime: "09:30" }).preferredTime, "09:30");
  assert.ok(fieldErrors({ preferredWindow: "Midnight" }).preferredWindow);
  assert.ok(fieldErrors({ preferredTime: "9am" }).preferredTime);
});

test("QA-3: dates and times are checked in Chicago time", () => {
  assert.ok(fieldErrors({ preferredDate: "2027-01-13" }).preferredDate);
  assert.equal(ok({ preferredDate: "2027-01-14", preferredTime: "12:00" }).preferredTime, "12:00");
  assert.ok(fieldErrors({ preferredDate: "2027-01-14", preferredTime: "11:00" }).preferredTime);
  assert.equal(ok({ preferredDate: "2027-01-15" }).preferredDate.toISOString(), "2027-01-15T00:00:00.000Z");
});

test("QA-20: an exact time outside the chosen window turns the window into Flexible", () => {
  const morning16 = ok({ preferredWindow: "Morning", preferredTime: "16:00" });
  assert.equal(morning16.preferredWindow, "Flexible");
  assert.equal(morning16.preferredTime, "16:00");
  assert.equal(ok({ preferredWindow: "Morning", preferredTime: "09:30" }).preferredWindow, "Morning");
  assert.equal(ok({ preferredWindow: "Midday", preferredTime: "12:30" }).preferredWindow, "Midday");
  assert.equal(ok({ preferredWindow: "Midday", preferredTime: "11:59" }).preferredWindow, "Flexible");
  assert.equal(ok({ preferredWindow: "Afternoon", preferredTime: "15:00" }).preferredWindow, "Afternoon");
  assert.equal(ok({ preferredWindow: "Afternoon", preferredTime: "17:30" }).preferredWindow, "Flexible");
  assert.equal(ok({ preferredWindow: "Flexible", preferredTime: "07:00" }).preferredWindow, "Flexible");
  // No exact time: the window is kept as chosen.
  assert.equal(ok({ preferredWindow: "Afternoon", preferredTime: "" }).preferredWindow, "Afternoon");
});

test("SEC-18: line breaks and control characters in single-line fields collapse to a space", () => {
  const data = ok({
    name: "Mallory\r\nFree first-shoot drone photos: Yes - eligible",
    phone: "3125550100\nFax: 999",
    agencyName: `Acme${LS}Realty${String.fromCharCode(9)}Group`,
    propertyAddress: "123 Main St\r\nChicago\u0000"
  });
  assert.equal(data.name, "Mallory Free first-shoot drone photos: Yes - eligible");
  assert.equal(data.phone, "3125550100 Fax: 999");
  assert.equal(data.agencyName, "Acme Realty Group");
  assert.equal(data.propertyAddress, "123 Main St Chicago");
  for (const value of [data.name, data.phone, data.agencyName ?? "", data.propertyAddress]) {
    assert.doesNotMatch(value, new RegExp(`[${LS}${PS}]`));
    assert.ok(value.split("").every((c) => c.charCodeAt(0) >= 32), JSON.stringify(value));
  }
  // The message keeps its line breaks.
  assert.equal(ok({ message: "Line one\nLine two is here" }).message, "Line one\nLine two is here");
});

// DES-25 (batch 5a round 1): the message is optional; the length cap and line handling stay.
test("message is optional: missing, blank or a single word all save", () => {
  const { message: _omit, ...withoutMessage } = base;
  void _omit;
  assert.equal(schema.safeParse(withoutMessage).success, true);
  assert.equal(ok({ message: "" }).message, "");
  assert.equal(ok({ message: "   " }).message, "");
  assert.equal(ok({ message: "vacant" }).message, "vacant");
  assert.ok(fieldErrors({ message: "x".repeat(4001) }).message);
});

// DES-26: "No photos, other services only" posts "none", which means no package.
test("photoPackage 'none' means no package", () => {
  assert.equal(ok({ photoPackage: "none", addOns: "floor-plans" }).photoPackage, NO_PHOTO_PACKAGE);
  assert.ok(fieldErrors({ photoPackage: "none" }).services);
  assert.ok(fieldErrors({ photoPackage: "none", addOns: "drone-photos", firstShootOffer: "on" }).firstShootOffer);
});

// Security (5a final): the booking form's "none" value can never be a real service slug.
test("serviceSchema reserves the slug 'none'", () => {
  const service = {
    title: "Twilight",
    slug: "none",
    category: "PHOTO",
    summary: "A summary that is long enough.",
    description: "A description that is long enough to pass.",
    startingAt: 100,
    deliverable: "Photos",
    turnaround: "Confirmed when you book"
  };
  assert.equal(serviceSchema.safeParse(service).success, false);
  assert.equal(serviceSchema.safeParse({ ...service, slug: "none-extra" }).success, true);
});
