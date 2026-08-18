import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reduceTest } from "../../src/reduce.ts";

const root = resolve(import.meta.dirname, "../..");

describe("live compact reduction", { timeout: 180_000 }, () => {
  it("shrinks fixture G and keeps the crash", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "repromin-live-"));
    const result = await reduceTest({
      specPath: join(root, "fixtures/tests/g-compact.spec.ts"),
      testName: "compact checkout crash",
      confirm: 2,
      searchConfirm: 1,
      timeoutMs: 8_000,
      outDir,
      configPath: join(root, "fixtures/playwright.config.ts"),
      maxRuns: 80,
      noCache: false,
      cacheDir: join(outDir, "cache"),
      headed: false,
      dryRun: false,
      keepAssertions: false,
      verbose: true,
    });
    assert.equal(result.rejectReason, undefined, result.rejectReason);
    assert.ok(result.reduced);
    assert.ok(result.original.actions >= 6);
    assert.ok(result.reduced.actions <= 4, `got ${result.reduced.actions} actions`);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.original.fingerprint.message, /PAYMENT_GATEWAY_CRASH/);
    assert.match(result.reduced.source, /promo|place-order|SAVE20/);
    assert.equal(result.confirmations.passed, 2);
    process.stdout.write(
      `\nLIVE G  ${result.original.actions} → ${result.reduced.actions} actions  ` +
        `${result.confirmations.passed}/${result.confirmations.total}  ${result.runs} runs\n`,
    );
  });
});
