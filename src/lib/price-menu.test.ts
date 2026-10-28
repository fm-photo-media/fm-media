import assert from "node:assert/strict";
import test from "node:test";
import { bookingHref, displayPrice, menuItemsFrom, menuTotal, prefillFromQuery, readableRange, DRONE_PHOTOS_SLUG } from "./price-menu";

type S = Parameters<typeof menuItemsFrom>[0][number];
const svc = (over: Partial<S>): S =>
  ({
    id: over.slug ?? "x",
    title: "T",
    slug: "x",
    category: "PHOTO",
    priceLabel: null,
    bestUse: null,
    squareFeet: null,
    summary: "summary text",
    description: "description text here",
    startingAt: 0,
    deliverable: "d",
    turnaround: "t",
    sortOrder: 0,
    featured: false,
    published: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over
  }) as S;

const services = [
  svc({ slug: "basic", title: "Basic", category: "PHOTO", priceLabel: "$100", startingAt: 100, squareFeet: "Up to 1,500 sq ft", deliverable: "10-15 professionally edited photos" }),
  svc({ slug: "luxury", title: "Luxury", category: "PHOTO", priceLabel: "$250-$400+", startingAt: 250, squareFeet: "4,000+ sq ft", deliverable: "40-60 photos" }),
  svc({ slug: DRONE_PHOTOS_SLUG, title: "Drone Photos", category: "ADD_ON", priceLabel: "$75", startingAt: 75, deliverable: "5-10 aerial shots" }),
  svc({ slug: "floor-plans", title: "Floor Plans", category: "ADD_ON", priceLabel: "$50", startingAt: 50, deliverable: "2D layout floor plan" }),
  svc({ slug: "walk", title: "Basic Walkthrough", category: "VIDEO", priceLabel: "$150", startingAt: 150, deliverable: "1-2 minute video" }),
  svc({ slug: "repeat", title: "Repeat", category: "DISCOUNT", priceLabel: "10%-20% off", startingAt: 0 })
];

test("readableRange: number ranges read 'to' instead of a hyphen", () => {
  assert.equal(readableRange("$250-$400+"), "$250 to $400+");
  assert.equal(readableRange("10-15 professionally edited photos"), "10 to 15 professionally edited photos");
  assert.equal(readableRange("2D layout floor plan"), "2D layout floor plan");
});

test("displayPrice: label from the DB, made readable; falls back to startingAt", () => {
  assert.equal(displayPrice(services[1]), "$250 to $400+");
  assert.equal(displayPrice(svc({ priceLabel: null, startingAt: 90 })), "$90");
  assert.equal(displayPrice(svc({ priceLabel: null, startingAt: 0 })), "Custom");
});

test("menuItemsFrom: packages, add-ons and video from the DB; discounts left out", () => {
  const menu = menuItemsFrom(services);
  assert.deepEqual(menu.packages.map((i) => i.slug), ["basic", "luxury"]);
  assert.deepEqual(menu.addOns.map((i) => i.slug), [DRONE_PHOTOS_SLUG, "floor-plans"]);
  assert.deepEqual(menu.video.map((i) => i.slug), ["walk"]);
  assert.equal(menu.packages[0].note, "Up to 1,500 sq ft. 10 to 15 professionally edited photos.");
  assert.equal(menu.packages[1].plus, true);
  assert.equal(menu.packages[0].plus, false);
  assert.equal(menu.addOns[0].note, "5 to 10 aerial shots.");
});

const menu = menuItemsFrom(services);

test("menuTotal: package plus add-ons", () => {
  const total = menuTotal(menu, { packageSlug: "basic", extras: [DRONE_PHOTOS_SLUG], firstShoot: false });
  assert.equal(total.amount, 175);
  assert.equal(total.label, "$175");
  assert.equal(total.droneFree, false);
});

test("menuTotal: the first-shoot offer makes drone photos free with a package (Legal's terms)", () => {
  const total = menuTotal(menu, { packageSlug: "basic", extras: [DRONE_PHOTOS_SLUG], firstShoot: true });
  assert.equal(total.amount, 100);
  assert.equal(total.droneFree, true);
});

test("menuTotal: no free drone without a photo package", () => {
  const total = menuTotal(menu, { packageSlug: "", extras: [DRONE_PHOTOS_SLUG], firstShoot: true });
  assert.equal(total.amount, 75);
  assert.equal(total.droneFree, false);
});

test("menuTotal: a '+' price makes the total open-ended; unknown slugs are ignored", () => {
  const total = menuTotal(menu, { packageSlug: "luxury", extras: ["walk", "gone"], firstShoot: false });
  assert.equal(total.label, "$400+");
  assert.equal(total.amount, 400);
});

test("bookingHref: carries the choices to the booking form", () => {
  assert.equal(
    bookingHref({ packageSlug: "basic", extras: [DRONE_PHOTOS_SLUG, "walk"], firstShoot: true }),
    "/contact?package=basic&add=drone-photos&add=walk&first=1#form"
  );
  assert.equal(bookingHref({ packageSlug: "", extras: [], firstShoot: false }), "/contact#form");
});

test("prefillFromQuery: only known slugs, sorted into package, add-ons and video", () => {
  const options = {
    photoPackages: [{ value: "basic", label: "Basic - $100" }],
    addOns: [{ value: DRONE_PHOTOS_SLUG, label: "Drone Photos - $75" }],
    videoServices: [{ value: "walk", label: "Walk - $150" }]
  };
  const prefill = prefillFromQuery(new URLSearchParams("package=basic&add=drone-photos&add=walk&add=nope&first=1"), options);
  assert.deepEqual(prefill, { photoPackage: "basic", addOns: [DRONE_PHOTOS_SLUG], videoServices: ["walk"], firstShoot: true });
  const empty = prefillFromQuery(new URLSearchParams("package=evil&first=yes"), options);
  assert.deepEqual(empty, { photoPackage: "", addOns: [], videoServices: [], firstShoot: false });
});

// DES-28 (batch 5a round 1): the discount line keeps its figure from the DB.
test("discountSentence reads the DB price label as a range", async () => {
  const { discountSentence } = await import("./services");
  assert.equal(
    discountSentence({ priceLabel: "10%-20% off", summary: "s" }),
    "Repeat-listing discounts (10%-20% off) are available on some packages and are confirmed in your quote."
  );
  assert.equal(discountSentence({ priceLabel: null, summary: " Ask about repeat rates. " }), "Ask about repeat rates.");
});
