import assert from "node:assert/strict";
import test from "node:test";
import { groupByShoot, shootCaption } from "./portfolio";
import { galleryImageSchema } from "./validation";

const base = {
  title: "Front exterior",
  alt: "Front of a frame house with a porch",
  category: "Exterior",
  imageUrl: "/images/own/house.jpg",
  width: 2000,
  height: 1333
};

test("gallery schema: shoot and town are optional and blank becomes null", () => {
  const parsed = galleryImageSchema.parse({ ...base, shoot: "  ", town: "" });
  assert.equal(parsed.shoot, null);
  assert.equal(parsed.town, null);
  const missing = galleryImageSchema.parse(base);
  assert.equal(missing.shoot, null);
  assert.equal(missing.town, null);
});

test("gallery schema: shoot and town are trimmed and kept", () => {
  const parsed = galleryImageSchema.parse({ ...base, shoot: " Frame house ", town: " Oak Park " });
  assert.equal(parsed.shoot, "Frame house");
  assert.equal(parsed.town, "Oak Park");
});

test("gallery schema: length caps on shoot (80) and town (60)", () => {
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "a".repeat(81) }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "a".repeat(80) }).success, true);
  assert.equal(galleryImageSchema.safeParse({ ...base, town: "a".repeat(61) }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, town: "a".repeat(60) }).success, true);
});

test("gallery schema: a town or shoot that looks like a street address is refused", () => {
  assert.equal(galleryImageSchema.safeParse({ ...base, town: "6541 N Oak Ave" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, town: "Oak Park 60302" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "6541 Oak Ave" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "Two-flat with garden" }).success, true);
  // Legal R2 / Security note (round 1): any digit, or a leading "#", is refused in a shoot name.
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "6541-Elm house" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "Elm St 6541" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, shoot: "#Elm" }).success, false);
  assert.equal(galleryImageSchema.safeParse({ ...base, town: "Oak Park ２" }).success, false);
});

type Row = { id: string; shoot: string | null; town: string | null };
const row = (id: string, shoot: string | null, town: string | null = null): Row => ({ id, shoot, town });

test("groupByShoot: groups by shoot in first-seen order, ungrouped images last as one set", () => {
  const groups = groupByShoot([row("1", "Frame house", "Oak Park"), row("2", null), row("3", "Condo"), row("4", "Frame house"), row("5", null)]);
  assert.deepEqual(
    groups.map((g) => [g.key, g.images.map((i) => i.id)]),
    [
      ["shoot:Frame house", ["1", "4"]],
      ["shoot:Condo", ["3"]],
      ["ungrouped", ["2", "5"]]
    ]
  );
});

test("groupByShoot: shoot names match case-insensitively and ignore extra spaces", () => {
  const groups = groupByShoot([row("1", "Frame house"), row("2", " frame  house ")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].images.length, 2);
});

test("groupByShoot: the town is the first one given in the group", () => {
  const groups = groupByShoot([row("1", "Frame house"), row("2", "Frame house", "Evanston")]);
  assert.equal(groups[0].town, "Evanston");
});

test("groupByShoot: no images, no groups; all ungrouped, one set", () => {
  assert.deepEqual(groupByShoot([]), []);
  const groups = groupByShoot([row("1", null), row("2", null)]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].shoot, null);
});

test("shootCaption: '[Shoot], [Town]', or whichever exists", () => {
  assert.equal(shootCaption("Frame house", "Oak Park"), "Frame house, Oak Park");
  assert.equal(shootCaption("Frame house", null), "Frame house");
  assert.equal(shootCaption(null, "Oak Park"), "Oak Park");
  assert.equal(shootCaption(null, null), null);
});
