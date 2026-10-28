import { test } from "node:test";
import assert from "node:assert/strict";
import { inquirySchema } from "./validation";

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const base = {
  name: "Test Agent",
  email: "agent@example.com",
  phone: "312-555-0100",
  propertyAddress: "123 Main St, Chicago",
  photoPackage: "Basic - $100",
  preferredDate: tomorrow(),
  preferredTime: "10:00",
  message: "Two-story home, vacant."
};

function offer(value: unknown) {
  const parsed = inquirySchema.safeParse(value === undefined ? base : { ...base, firstShootOffer: value });
  assert.ok(parsed.success, JSON.stringify(!parsed.success && parsed.error.issues));
  return parsed.data.firstShootOffer;
}

test("a ticked checkbox ('on') and boolean true save the first-shoot offer", () => {
  assert.equal(offer("on"), true);
  assert.equal(offer(true), true);
});

test("anything else saves false, including the strings 'false' and 'true'", () => {
  assert.equal(offer(undefined), false);
  assert.equal(offer(null), false);
  assert.equal(offer(false), false);
  assert.equal(offer("false"), false);
  assert.equal(offer("true"), false);
  assert.equal(offer("1"), false);
  assert.equal(offer(""), false);
});
