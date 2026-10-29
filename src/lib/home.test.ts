import assert from "node:assert/strict";
import test from "node:test";
import { homeHero, lowestPackage, packageLine, priceHeadline } from "./home";

// Batch 8 (design.md "Build spec: Variant B", "The photo decision"): the home hero is
// hero--photo only when one of Francisco's own featured photos exists, otherwise hero--name.
// getFeaturedGalleryImages has already dropped repo samples and stock links (gallery-visibility.ts).

const photo = (id: string, category: string) => ({ id, category, imageUrl: `/x/${id}.jpg`, alt: `alt ${id}` });

test("homeHero: no featured photo of his gives the name-first hero, with no photo anywhere", () => {
  const state = homeHero([]);
  assert.equal(state.mode, "name");
  assert.equal(state.hero, undefined);
  assert.equal(state.interior, undefined);
});

test("homeHero: one featured photo gives the photo hero and no second photo", () => {
  const only = photo("a", "Interior");
  const state = homeHero([only]);
  assert.equal(state.mode, "photo");
  assert.equal(state.hero, only);
  assert.equal(state.interior, undefined);
});

test("homeHero: a featured exterior is preferred for the hero; the next photo goes under the prices", () => {
  const inside = photo("in", "Interior");
  const outside = photo("out", "Exterior");
  const state = homeHero([inside, outside]);
  assert.equal(state.mode, "photo");
  assert.equal(state.hero, outside);
  assert.equal(state.interior, inside);
});

test("homeHero: without an exterior, the first featured photo leads", () => {
  const first = photo("1", "Kitchen");
  const second = photo("2", "Living room");
  const state = homeHero([first, second]);
  assert.equal(state.hero, first);
  assert.equal(state.interior, second);
});

type Svc = Parameters<typeof lowestPackage>[0][number];
const svc = (over: Partial<Svc>): Svc => ({ title: "T", category: "PHOTO", startingAt: 0, squareFeet: null, deliverable: "", ...over });

const seed = [
  svc({ title: "Standard", startingAt: 135, squareFeet: "Up to 2,500 sq ft", deliverable: "20-25 professionally edited photos" }),
  svc({ title: "Basic", startingAt: 100, squareFeet: "Up to 1,500 sq ft", deliverable: "10-15 professionally edited photos" }),
  svc({ title: "Drone Photos", category: "ADD_ON", startingAt: 75, deliverable: "5-10 aerial shots" }),
  svc({ title: "Repeat", category: "DISCOUNT", startingAt: 0 })
];

test("lowestPackage: the cheapest priced PHOTO row, never an add-on", () => {
  assert.equal(lowestPackage(seed)?.title, "Basic");
  assert.equal(lowestPackage(seed.filter((s) => s.category !== "PHOTO")), undefined);
  assert.equal(lowestPackage([svc({ title: "Custom", startingAt: 0 })]), undefined, "a $0 (custom) package doesn't set the from-price");
});

test("packageLine: the lowest package as one sentence, from the DB fields", () => {
  assert.equal(packageLine(lowestPackage(seed)), "Basic covers a home up to 1,500 sq ft with 10 to 15 edited photos.");
  assert.equal(packageLine(svc({ title: "Basic", startingAt: 100, squareFeet: null, deliverable: "" })), "");
  assert.equal(packageLine(svc({ title: "Basic", startingAt: 100, squareFeet: null, deliverable: "12 photos" })), "Basic comes with 12 photos.");
  assert.equal(packageLine(undefined), "");
});

test("priceHeadline: 'Listing photos from $X' with the lowest package price, or a plain title with none", () => {
  assert.deepEqual(priceHeadline([{ amount: 135 }, { amount: 100 }, { amount: 0 }]), { lowest: 100 });
  assert.deepEqual(priceHeadline([]), { lowest: null });
  assert.deepEqual(priceHeadline([{ amount: 0 }]), { lowest: null });
});
