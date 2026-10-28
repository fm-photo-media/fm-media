import { test } from "node:test";
import assert from "node:assert/strict";
import type { Inquiry } from "@prisma/client";
import { bookingEmailText } from "./email";

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
