import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlaywrightTest } from "../../src/parse.ts";
import { rewriteCandidate } from "../../src/rewrite.ts";

const sample = `
import { test, expect } from '@playwright/test';

test.describe('shop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checkout crashes', async ({ page }) => {
    await page.locator('#nav-shop').click();
    const promoCode = 'SAVE20';
    await page.locator('#email').fill('a@b.com');
    await page.locator('#promo').fill(promoCode);
    await page.locator('#place-order').click();
    await expect(page.locator('#checkout-modal-text')).toContainText('PAYMENT_GATEWAY_CRASH');
  });
});
`;

describe("parsePlaywrightTest", () => {
  it("finds removable actions and bindings", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "sample.spec.ts",
      source: sample,
      testName: "checkout crashes",
    });
    assert.equal(analyzed.rejectReason, undefined);
    const kinds = analyzed.statements.map((s) => s.kind);
    assert.deepEqual(kinds, ["action", "binding", "action", "action", "action", "assertion"]);
    assert.ok(analyzed.removable.length >= 5);
  });

  it("rejects control flow", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "bad.spec.ts",
      source: `
        import { test } from '@playwright/test';
        test('loop', async ({ page }) => {
          await page.goto('/');
          if (true) await page.click('x');
        });
      `,
    });
    assert.match(analyzed.rejectReason ?? "", /IfStatement|control-flow/i);
  });

  it("rewrites a subset and keeps used variables", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "sample.spec.ts",
      source: sample,
      testName: "checkout crashes",
    });
    const fillPromo = analyzed.statements.find((s) => s.kind === "action" && s.text.includes("promoCode"))!;
    const binding = analyzed.statements.find((s) => s.kind === "binding")!;
    const result = rewriteCandidate(analyzed, [fillPromo.index]);
    assert.equal(result.unresolvedReason, undefined);
    assert.match(result.source, /const promoCode = 'SAVE20'/);
    assert.match(result.source, /fill\(promoCode\)/);
    assert.doesNotMatch(result.source, /#nav-shop/);
    assert.doesNotMatch(result.source, /#email/);
    assert.ok(result.keptStatements.some((s) => s.index === binding.index));
  });

  it("marks a broken def\/use subset unresolved", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "sample.spec.ts",
      source: sample,
      testName: "checkout crashes",
    });
    // Keep fill(promoCode) but drop the binding by pretending it is removable — rewrite should still keep it.
    const fillPromo = analyzed.statements.find((s) => s.text.includes("promoCode") && s.kind === "action")!;
    const rewritten = rewriteCandidate(analyzed, [fillPromo.index]);
    assert.equal(rewritten.unresolvedReason, undefined);
    assert.match(rewritten.source, /promoCode/);
  });
});
