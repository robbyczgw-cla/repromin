import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlaywrightTest } from "../../src/parse.ts";
import { rewriteCandidate } from "../../src/rewrite.ts";

describe("parse / rewrite edge cases", () => {
  it("rejects if/for in the test body", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "loop.spec.ts",
      source: `
        import { test } from '@playwright/test';
        test('loop', async ({ page }) => {
          await page.goto('/');
          for (let i = 0; i < 2; i++) await page.click('#x');
        });
      `,
    });
    assert.match(analyzed.rejectReason ?? "", /ForStatement|control-flow/i);
  });

  it("rejects test.step", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "step.spec.ts",
      source: `
        import { test } from '@playwright/test';
        test('step', async ({ page }) => {
          await test.step('go', async () => { await page.goto('/'); });
        });
      `,
    });
    assert.match(analyzed.rejectReason ?? "", /test\.step/);
  });

  it("requires --test when a file has two tests", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "two.spec.ts",
      source: `
        import { test } from '@playwright/test';
        test('one', async ({ page }) => { await page.goto('/'); });
        test('two', async ({ page }) => { await page.goto('/'); });
      `,
    });
    assert.match(analyzed.rejectReason ?? "", /2 tests|--test/);
  });

  it("keep-assertions leaves expect() out of the removable set", () => {
    const source = `
      import { test, expect } from '@playwright/test';
      test('t', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#x')).toHaveText('y');
      });
    `;
    const open = parsePlaywrightTest({ filePath: "t.spec.ts", source, testName: "t" });
    const locked = parsePlaywrightTest({
      filePath: "t.spec.ts",
      source,
      testName: "t",
      keepAssertions: true,
    });
    assert.ok(open.removable.length === 2);
    assert.ok(locked.removable.length === 1);
    assert.ok(locked.statements.some((s) => s.kind === "assertion"));
  });

  it("page.click and locator.press count as actions", () => {
    const analyzed = parsePlaywrightTest({
      filePath: "style.spec.ts",
      source: `
        import { test } from '@playwright/test';
        test('style', async ({ page }) => {
          await page.goto('/');
          await page.click('#nav-shop');
          await page.locator('#search').press('Enter');
          await page.getByRole('button', { name: 'View' }).click();
        });
      `,
      testName: "style",
    });
    assert.equal(analyzed.rejectReason, undefined);
    assert.equal(analyzed.removable.length, 4);
  });

  it("rewriting an empty keep set leaves a valid empty body", () => {
    const source = `
      import { test } from '@playwright/test';
      test('t', async ({ page }) => {
        await page.goto('/');
        await page.click('#x');
      });
    `;
    const analyzed = parsePlaywrightTest({ filePath: "t.spec.ts", source, testName: "t" });
    const out = rewriteCandidate(analyzed, []);
    assert.equal(out.unresolvedReason, undefined);
    assert.match(out.source, /async \(\{ page \}\) => \{\s*\}/);
  });
});
