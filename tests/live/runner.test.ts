import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runPlaywrightCandidate } from "../../src/runner.ts";
import { fingerprintsMatch, buildFingerprint } from "../../src/fingerprint.ts";
import { parsePlaywrightTest } from "../../src/parse.ts";
import { rewriteCandidate } from "../../src/rewrite.ts";

const root = resolve(import.meta.dirname, "../..");
const config = join(root, "fixtures/playwright.config.ts");

async function runSpec(rel: string, testName: string, source?: string) {
  const specPath = resolve(root, rel);
  return runPlaywrightCandidate({
    source: source ?? (await readFile(specPath, "utf8")),
    originalSpecPath: specPath,
    testName,
    configPath: config,
    timeoutMs: 10_000,
    headed: false,
  });
}

describe("live runner against Chromium", { timeout: 120_000 }, () => {
  it("original killer spec fails with the crash fingerprint", async () => {
    const result = await runSpec("fixtures/tests/killer.spec.ts", "checkout crashes");
    assert.equal(result.failed, true, result.unresolved ?? result.rawMessage);
    assert.match(result.fingerprint?.message ?? "", /PAYMENT_GATEWAY_CRASH/);
    assert.match(result.fingerprint?.message ?? "", /ORDER_PLACED/);
  });

  it("9-action killer path reproduces the same fingerprint", async () => {
    const original = await runSpec("fixtures/tests/killer.spec.ts", "checkout crashes");
    const minimizedSource = `import { test, expect } from "@playwright/test";
test.describe("killer demo", () => {
  test("checkout crashes", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
`;
    const minimized = await runSpec(
      "fixtures/tests/killer.spec.ts",
      "checkout crashes",
      minimizedSource,
    );
    assert.equal(minimized.failed, true, minimized.unresolved ?? minimized.rawMessage);
    assert.ok(original.fingerprint && minimized.fingerprint);
    assert.equal(fingerprintsMatch(original.fingerprint, minimized.fingerprint), true);
  });

  it("empty-cart candidate is a different failure", async () => {
    const crash = buildFingerprint({
      message: `Error: expect(locator).toHaveText(expected) failed
Expected: "ORDER_PLACED"
Received: "PAYMENT_GATEWAY_CRASH: order total is NaN"`,
    });
    const specPath = join(root, "fixtures/tests/e-two-failures.spec.ts");
    const source = await readFile(specPath, "utf8");
    const analyzed = parsePlaywrightTest({
      filePath: specPath,
      source,
      testName: "same test two failure modes",
    });
    const add = analyzed.statements.find((s) => s.text.includes("add-to-cart"));
    assert.ok(add);
    const withoutAdd = rewriteCandidate(
      analyzed,
      analyzed.removable.filter((i) => i !== add.index),
    );
    const result = await runSpec(specPath, "same test two failure modes", withoutAdd.source);
    assert.equal(result.failed, true, result.unresolved);
    assert.match(result.fingerprint?.message ?? "", /CART_EMPTY/);
    assert.equal(fingerprintsMatch(crash, result.fingerprint!), false);
  });

  it("dropping goto is not the crash — timeout / unresolved", async () => {
    const specPath = join(root, "fixtures/tests/killer.spec.ts");
    const source = await readFile(specPath, "utf8");
    const analyzed = parsePlaywrightTest({
      filePath: specPath,
      source,
      testName: "checkout crashes",
    });
    const gotoIdx = analyzed.statements.find((s) => s.text.includes("goto"))!.index;
    const withoutGoto = rewriteCandidate(
      analyzed,
      analyzed.removable.filter((i) => i !== gotoIdx),
    );
    const result = await runSpec(specPath, "checkout crashes", withoutGoto.source);
    const msg = result.fingerprint?.message ?? result.unresolved ?? "";
    assert.doesNotMatch(msg, /PAYMENT_GATEWAY_CRASH/);
    assert.match(msg, /Timeout|timeout|UNRESOLVED|not visible|exceeded/i);
  });

  it("compact original is a usable failure for reduction", async () => {
    const result = await runSpec("fixtures/tests/g-compact.spec.ts", "compact checkout crash");
    assert.equal(result.failed, true, result.unresolved);
    assert.match(result.fingerprint?.message ?? "", /PAYMENT_GATEWAY_CRASH/);
  });
});
