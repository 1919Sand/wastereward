import assert from "node:assert/strict";
import test from "node:test";
import { dateKeyInTimeZone, isValidDateKey } from "../lib/date";

test("uses the India calendar date after local midnight", () => {
  assert.equal(dateKeyInTimeZone(new Date("2026-10-17T19:00:00.000Z")), "2026-10-18");
});

test("keeps the prior India date before local midnight", () => {
  assert.equal(dateKeyInTimeZone(new Date("2026-10-17T18:29:59.000Z")), "2026-10-17");
});

test("validates real calendar dates", () => {
  assert.equal(isValidDateKey("2026-02-28"), true);
  assert.equal(isValidDateKey("2026-02-30"), false);
  assert.equal(isValidDateKey("2026-13-01"), false);
});
