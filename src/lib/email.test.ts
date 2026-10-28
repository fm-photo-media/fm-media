import { test } from "node:test";
import assert from "node:assert/strict";
import type { Inquiry } from "@prisma/client";
import { bookingEmailText } from "./email";

const LS = String.fromCharCode(0x2028);

const inquiry = {
  id: "abc",
  name: "Test Agent",
  email: "agent@example.com",
  phone: "312-555-0100",
  agencyName: null,
  propertyAddress: "123 Main St, Chicago",
  propertySize: "1,850 sq ft",
  photoPackage: "Basic - $120",
  addOns: "Drone Photos - $75",
  videoService: "None",
  firstShootOffer: true,
  shootType: "Listing Media Package",
  preferredDate: new Date("2027-01-14T00:00:00Z"),
  preferredTime: "Flexible",
  preferredWindow: "Morning",
  message: "Vacant, lockbox on the front door.",
  status: "NEW",
  emailStatus: "PENDING",
  emailError: null,
  submissionKey: null,
  createdAt: new Date(),
  updatedAt: new Date()
} satisfies Inquiry;

test("the notification email carries the new booking fields", () => {
  const text = bookingEmailText(inquiry);
  assert.match(text, /Approx\. square footage: 1,850 sq ft/);
  assert.match(text, /Preferred time window: Morning/);
  assert.match(text, /Exact start time: Flexible/);
  // Stored at UTC midnight; it must read as the same calendar day whatever the server TZ is.
  assert.match(text, /Preferred shoot date: Thu, Jan 14, 2027/);
  assert.match(text, /Free first-shoot drone photos: Yes/);
});

test("SEC-18: a line break in a single-line field can't fake another line in the email", () => {
  const text = bookingEmailText({
    ...inquiry,
    firstShootOffer: false,
    name: "Mallory\r\nFree first-shoot drone photos: Yes - eligible",
    phone: "312\nCustomer phone: 999-999-9999",
    agencyName: `Acme${LS}Realty`,
    propertyAddress: "1 Main\rSt"
  });
  const lines = text.split("\n");
  assert.equal(lines.filter((l) => l.startsWith("Free first-shoot drone photos:")).length, 1);
  assert.ok(lines.includes("Free first-shoot drone photos: No"));
  assert.equal(lines.filter((l) => l.startsWith("Customer phone:")).length, 1);
  assert.ok(lines.includes("Customer name: Mallory Free first-shoot drone photos: Yes - eligible"));
  assert.ok(lines.includes("Realtor / agency: Acme Realty"));
  assert.ok(lines.includes("Property address: 1 Main St"));
  assert.ok(!text.includes(String.fromCharCode(13)) && !text.includes(LS));
});

test("the message keeps its own line breaks, under its heading at the end", () => {
  const text = bookingEmailText({ ...inquiry, message: "Gate code 1234\nDog in yard" });
  assert.ok(text.endsWith("Message / special instructions:\nGate code 1234\nDog in yard"));
});
