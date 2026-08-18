import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFingerprint,
  fingerprintsMatch,
  normalizeFailureText,
} from "../../src/fingerprint.ts";

describe("fingerprint", () => {
  it("normalizes timestamps, ports, paths, and ids", () => {
    const raw =
      "Timeout 30000ms exceeded at /tmp/repromin-abc/candidate.spec.ts:12:3 worker=2 pid=4451 http://127.0.0.1:7878/ 2026-08-17T12:00:00.000Z deadbeefdeadbeefdeadbeefdeadbeef";
    const n = normalizeFailureText(raw);
    assert.match(n, /<time>/);
    assert.match(n, /<port>/);
    assert.match(n, /<path>/);
    assert.doesNotMatch(n, /7878/);
    assert.doesNotMatch(n, /30000/);
  });

  it("matches the same assertion after line-number drift", () => {
    const a = buildFingerprint({
      message: `Error: expect(locator).toContainText(expected)

Locator: locator('#checkout-modal-text')
Expected string: "PAYMENT_GATEWAY_CRASH: order total is NaN"
Received string: "ORDER_PLACED"
Call log:
  - candidate.spec.ts:88:40`,
    });
    const b = buildFingerprint({
      message: `Error: expect(locator).toContainText(expected)

Locator: locator('#checkout-modal-text')
Expected string: "PAYMENT_GATEWAY_CRASH: order total is NaN"
Received string: "ORDER_PLACED"
Call log:
  - candidate.spec.ts:12:40`,
    });
    assert.equal(fingerprintsMatch(a, b), true);
  });

  it("does not treat a different received failure as the same", () => {
    const crash = buildFingerprint({
      message: `Error: expect(locator).toHaveText(expected)
Expected string: "ORDER_PLACED"
Received string: "PAYMENT_GATEWAY_CRASH: order total is NaN"`,
    });
    const empty = buildFingerprint({
      message: `Error: expect(locator).toHaveText(expected)
Expected string: "ORDER_PLACED"
Received string: "CART_EMPTY"`,
    });
    assert.equal(fingerprintsMatch(crash, empty), false);

    const other = buildFingerprint({
      message: `TimeoutError: page.click: Timeout 4000ms exceeded.
Call log:
  - waiting for locator('#missing')`,
    });
    assert.equal(fingerprintsMatch(crash, other), false);
  });

  it("honors --error-regex as the source of truth", () => {
    const expected = buildFingerprint({
      message: "Error: anything",
      userRegex: "PAYMENT_GATEWAY_CRASH",
    });
    const actual = buildFingerprint({
      message: "Error: expect failed PAYMENT_GATEWAY_CRASH: order total is NaN",
    });
    assert.equal(fingerprintsMatch(expected, actual), true);
    const miss = buildFingerprint({ message: "Error: CART_EMPTY" });
    assert.equal(fingerprintsMatch(expected, miss), false);
  });

  it("does not accept a generic failed test", () => {
    const expected = buildFingerprint({
      message: "Error: expect(locator).toHaveText(expected)\nExpected string: \"SECRET_PANEL_OK\"",
    });
    const generic = buildFingerprint({
      message: "Error: Test failed",
    });
    assert.equal(fingerprintsMatch(expected, generic), false);
  });
});
