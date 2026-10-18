import assert from "node:assert/strict";
import test from "node:test";
import { generateClaimCode, hashClaimCode } from "../lib/claim-code";

test("generates a readable ten-character one-time code", () => {
  assert.match(generateClaimCode(), /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
});

test("claim-code hashing ignores case and separators", () => {
  assert.equal(hashClaimCode("ABCDE-23456"), hashClaimCode("abcde 23456"));
  assert.equal(hashClaimCode("ABCDE-23456").length, 64);
});
