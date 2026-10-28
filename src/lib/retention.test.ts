import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RETENTION_MONTHS, inquiryPage, monthsBefore, parseMonths, retentionMonthsFrom } from "./retention";

test("LEG-1: the documented default retention is 24 months, overridable by env", () => {
  assert.equal(DEFAULT_RETENTION_MONTHS, 24);
  assert.equal(retentionMonthsFrom({}), 24);
  assert.equal(retentionMonthsFrom({ INQUIRY_RETENTION_MONTHS: "36" }), 36);
  for (const bad of ["0", "-3", "abc", "", "1000"]) assert.equal(retentionMonthsFrom({ INQUIRY_RETENTION_MONTHS: bad }), 24, bad);
});

test("monthsBefore steps back calendar months and clamps the day", () => {
  assert.equal(monthsBefore(new Date("2027-01-14T16:00:00Z"), 24).toISOString(), "2025-01-14T16:00:00.000Z");
  assert.equal(monthsBefore(new Date("2027-03-31T12:00:00Z"), 1).toISOString(), "2027-02-28T12:00:00.000Z");
  assert.equal(monthsBefore(new Date("2028-03-31T12:00:00Z"), 1).toISOString(), "2028-02-29T12:00:00.000Z");
});

test("the manual purge only accepts a sane whole number of months", () => {
  assert.equal(parseMonths("24"), 24);
  assert.equal(parseMonths(" 6 "), 6);
  for (const bad of ["0", "-1", "1.5", "abc", "", "121", null]) assert.equal(parseMonths(bad), null, String(bad));
});

test("inquiry paging: 20 per page, and bad page numbers fall back to page 1", () => {
  assert.deepEqual(inquiryPage("1", 45), { page: 1, pageCount: 3, skip: 0, take: 20 });
  assert.deepEqual(inquiryPage("3", 45), { page: 3, pageCount: 3, skip: 40, take: 20 });
  assert.deepEqual(inquiryPage("9", 45), { page: 3, pageCount: 3, skip: 40, take: 20 });
  assert.deepEqual(inquiryPage("x", 45), { page: 1, pageCount: 3, skip: 0, take: 20 });
  assert.deepEqual(inquiryPage(undefined, 0), { page: 1, pageCount: 1, skip: 0, take: 20 });
});
