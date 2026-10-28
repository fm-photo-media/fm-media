import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryImageSchema, makeInquirySchema, serviceSchema, type BookingOptions } from "./validation";

// Batch 6 (zod 4): every message a visitor or the owner can see is pinned word for word,
// so a library upgrade can't silently change the copy. actions.ts shows the first issue
// per field, so that's what is checked here.

const now = () => new Date("2027-01-14T16:00:00Z");
const options: BookingOptions = {
  photoPackages: [{ value: "basic", label: "Basic - $120" }],
  addOns: [{ value: "floor-plans", label: "Floor Plans - $50" }],
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
  message: ""
};

type Parsed = { success: true } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };

/** The first message per field, as actions.ts builds `fields`. */
function firstMessages(input: Record<string, unknown>, parsed: Parsed = schema.safeParse(input)) {
  assert.equal(parsed.success, false, "expected a validation error");
  const fields: Record<string, string> = {};
  if (!parsed.success) for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  return fields;
}

const STALE = "That option is no longer offered. Please choose again.";
const SQFT = "Enter the approximate square footage as a number, like 1800.";
const TIME = "Choose a time like 09:30, or leave it blank.";

const inquiryCases: [string, Record<string, unknown>, Record<string, string>][] = [
  ["short name", { name: "A" }, { name: "Enter your name." }],
  ["blank name", { name: "" }, { name: "Enter your name." }],
  ["long name", { name: "a".repeat(121) }, { name: "Keep this under 120 characters." }],
  ["bad email", { email: "nope" }, { email: "Enter a valid email." }],
  ["blank email", { email: "" }, { email: "Enter a valid email." }],
  ["long email", { email: `${"a".repeat(250)}@example.com` }, { email: "Keep this under 254 characters." }],
  ["short phone", { phone: "123" }, { phone: "Enter a complete phone number." }],
  ["long phone", { phone: "3".repeat(31) }, { phone: "Enter a phone number under 30 characters." }],
  ["long agency", { agencyName: "a".repeat(161) }, { agencyName: "Keep this under 160 characters." }],
  ["short address", { propertyAddress: "abc" }, { propertyAddress: "Enter the property address." }],
  ["long address", { propertyAddress: "a".repeat(301) }, { propertyAddress: "Keep this under 300 characters." }],
  ["bad sq ft", { squareFeet: "big" }, { squareFeet: SQFT }],
  ["long sq ft", { squareFeet: "1".repeat(21) }, { squareFeet: "Keep this under 20 characters." }],
  ["stale package", { photoPackage: "zzz" }, { photoPackage: STALE }],
  ["long package", { photoPackage: "x".repeat(101) }, { photoPackage: "Keep this under 100 characters." }],
  ["stale add-on", { addOns: "zzz" }, { addOns: STALE }],
  ["stale video", { videoService: "zzz" }, { videoService: STALE }],
  ["no service", { photoPackage: "" }, { services: "Please select at least one service before booking." }],
  [
    "offer without a package",
    { photoPackage: "", addOns: "floor-plans", firstShootOffer: "on" },
    { firstShootOffer: "The free drone photos come with a photo package. Choose a package above or untick this box." }
  ],
  ["blank date", { preferredDate: "" }, { preferredDate: "Choose a date." }],
  ["bad date", { preferredDate: "hello" }, { preferredDate: "Choose a date." }],
  ["long date", { preferredDate: "2027-01-155555" }, { preferredDate: "Keep this under 10 characters." }],
  ["past date", { preferredDate: "2027-01-13" }, { preferredDate: "Choose today or a future date." }],
  ["bad time", { preferredTime: "9am" }, { preferredTime: TIME }],
  ["long time", { preferredTime: "123456" }, { preferredTime: "Keep this under 5 characters." }],
  ["time too soon", { preferredDate: "2027-01-14", preferredTime: "11:00" }, { preferredTime: "Choose a time at least 90 minutes from now." }],
  ["bad window", { preferredWindow: "Midnight" }, { preferredWindow: "Choose a time window." }],
  ["long message", { message: "x".repeat(4001) }, { message: "Keep this under 4000 characters." }],
  ["long shoot type", { shootType: "x".repeat(121) }, { shootType: "Keep this under 120 characters." }]
];

for (const [name, overrides, expected] of inquiryCases) {
  test(`booking message, ${name}`, () => {
    assert.deepEqual(firstMessages({ ...base, ...overrides }), expected);
  });
}

test("several bad fields each keep their own message", () => {
  assert.deepEqual(firstMessages({ ...base, name: "", email: "x", phone: "1", photoPackage: "" }), {
    name: "Enter your name.",
    email: "Enter a valid email.",
    phone: "Enter a complete phone number.",
    services: "Please select at least one service before booking."
  });
});

const service = {
  title: "Twilight",
  slug: "twilight",
  category: "PHOTO",
  summary: "A summary that is long enough.",
  description: "A description that is long enough to pass.",
  startingAt: "100",
  deliverable: "Photos",
  turnaround: "Confirmed when you book"
};

test("serviceSchema: slug messages, coercion and defaults", () => {
  assert.deepEqual(firstMessages({ ...service, slug: "A B" }, serviceSchema.safeParse({ ...service, slug: "A B" })), {
    slug: "Use a URL-friendly slug."
  });
  assert.deepEqual(firstMessages({}, serviceSchema.safeParse({ ...service, slug: "none" })), {
    slug: 'The slug "none" is reserved.'
  });
  assert.equal(serviceSchema.safeParse({ ...service, startingAt: "abc" }).success, false);
  const parsed = serviceSchema.parse({ ...service, category: undefined, startingAt: "", featured: "", published: "on" });
  assert.equal(parsed.category, "PHOTO");
  assert.equal(parsed.startingAt, 0);
  assert.equal(parsed.sortOrder, 0);
  assert.equal(parsed.featured, false);
  assert.equal(parsed.published, true);
});

const photo = { title: "Frame house", alt: "", category: "Exterior", imageUrl: "/images/portfolio/real-estate-photo-01.jpg" };
const ALT = "Add alt text (8 characters or more) before publishing this photo.";

test("galleryImageSchema: alt, caption and URL messages", () => {
  const issues = (overrides: Record<string, unknown>) => firstMessages({}, galleryImageSchema.safeParse({ ...photo, ...overrides }));
  assert.deepEqual(issues({ published: true }), { alt: ALT });
  assert.deepEqual(issues({ alt: "short" }), { alt: ALT });
  assert.deepEqual(issues({ shoot: "12 Main" }), { shoot: "Name the shoot by the kind of home, with no numbers and no street name." });
  assert.deepEqual(issues({ town: "Oak 9" }), { town: "Enter the town only, with no numbers and no street name." });
  assert.deepEqual(issues({ imageUrl: "https://x.com/a.jpg" }), {
    imageUrl: "Upload your own image file. Outside links, such as stock photos, can't be used."
  });
  assert.deepEqual(Object.keys(issues({ width: "100", height: "100" })), ["width", "height"]);
});

test("galleryImageSchema: defaults and blank captions", () => {
  const parsed = galleryImageSchema.parse({ ...photo, alt: undefined, shoot: "  ", town: "Oak Park" });
  assert.equal(parsed.alt, "");
  assert.equal(parsed.shoot, null);
  assert.equal(parsed.town, "Oak Park");
  assert.equal(parsed.width, 1600);
  assert.equal(parsed.height, 1100);
  assert.equal(parsed.featured, false);
  assert.equal(parsed.published, false);
});
