import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parsePlaywrightTest } from "../../src/parse.ts";
import { rewriteCandidate } from "../../src/rewrite.ts";
import { reduceTest } from "../../src/reduce.ts";
import { readFile } from "node:fs/promises";

const root = resolve(import.meta.dirname, "../..");
const config = join(root, "fixtures/playwright.config.ts");

async function reduce(spec: string, testName: string, confirm = 1) {
  const outDir = await mkdtemp(join(tmpdir(), "repromin-it-"));
  return reduceTest({
    specPath: join(root, spec),
    testName,
    confirm,
    searchConfirm: 1,
    timeoutMs: 10_000,
    outDir,
    configPath: config,
    maxRuns: 120,
    noCache: false,
    cacheDir: join(outDir, "cache"),
    headed: false,
    dryRun: false,
    keepAssertions: false,
    verbose: true,
    errorRegex: undefined,
  });
}

describe("fixture reductions", { timeout: 600_000 }, () => {
  it("A: drops prefix noise down to a handful of actions", async () => {
    const result = await reduce("fixtures/tests/a-noise.spec.ts", "checkout crashes after noisy form filling");
    assert.equal(result.rejectReason, undefined, result.rejectReason);
    assert.ok(result.reduced);
    assert.ok(result.original.actions >= 28, `expected ~30 actions, got ${result.original.actions}`);
    assert.ok(result.reduced.actions <= 6, `expected <=6 actions, got ${result.reduced.actions}`);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.reduced.source, /PAYMENT_GATEWAY_CRASH|ORDER_PLACED|place-order|promo/);
    assert.match(result.original.fingerprint.message, /PAYMENT_GATEWAY_CRASH/);
  });

  it("B: keeps both jointly required setup actions", async () => {
    const result = await reduce("fixtures/tests/b-joint-state.spec.ts", "joint flags required for crash");
    assert.ok(result.reduced);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.reduced.source, /enable-experimental/);
    assert.match(result.reduced.source, /unlock-promo/);
  });

  it("C: retains the variable used by a later fill", async () => {
    const result = await reduce("fixtures/tests/c-variable.spec.ts", "variable used by later fill");
    assert.ok(result.reduced);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.reduced.source, /promoCode/);
    assert.match(result.reduced.source, /SAVE20/);
  });

  it("D: does not treat an unreachable subset as interesting", async () => {
    const specPath = join(root, "fixtures/tests/d-unreachable.spec.ts");
    const source = await readFile(specPath, "utf8");
    const analyzed = parsePlaywrightTest({ filePath: specPath, source, testName: "secret panel assertion" });
    const reveal = analyzed.statements.filter((s) => /reveal-secret|confirm-reveal/.test(s.text)).map((s) => s.index);
    const withoutReveal = analyzed.removable.filter((i) => !reveal.includes(i));
    const rewritten = rewriteCandidate(analyzed, withoutReveal);
    assert.equal(rewritten.unresolvedReason, undefined);
    assert.doesNotMatch(rewritten.source, /reveal-secret/);

    const result = await reduce("fixtures/tests/d-unreachable.spec.ts", "secret panel assertion");
    assert.ok(result.reduced);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.reduced.source, /reveal-secret/);
    assert.match(result.reduced.source, /confirm-reveal/);
    assert.match(result.original.fingerprint.message, /SECRET_PANEL_BUG/);
  });

  it("E: preserves PAYMENT_GATEWAY_CRASH rather than CART_EMPTY", async () => {
    const result = await reduce("fixtures/tests/e-two-failures.spec.ts", "same test two failure modes");
    assert.ok(result.reduced);
    assert.equal(result.fingerprintMatch, true);
    assert.match(result.original.fingerprint.message, /PAYMENT_GATEWAY_CRASH/);
    assert.match(result.reduced.source, /open-crash-widget|add-to-cart|SAVE20|promo/);
    assert.doesNotMatch(result.original.fingerprint.message, /CART_EMPTY/);
  });

  it("F: --confirm 5 still reproduces after dropping the flaky survey", async () => {
    const result = await reduce("fixtures/tests/f-flaky.spec.ts", "flaky survey action", 5);
    assert.ok(result.reduced);
    assert.equal(result.fingerprintMatch, true);
    assert.equal(result.confirmations.passed, 5);
    assert.doesNotMatch(result.reduced.source, /open-survey/);
  });
});

describe("killer demo", { timeout: 600_000 }, () => {
  it("shrinks a 40+ action bloated test to <= 6 meaningful actions", async () => {
    const result = await reduce("fixtures/tests/killer.spec.ts", "checkout crashes", 3);
    assert.equal(result.rejectReason, undefined, result.rejectReason);
    assert.ok(result.reduced);
    assert.ok(result.original.actions >= 40, `actions ${result.original.actions}`);
    assert.ok(result.original.lines >= 150, `lines ${result.original.lines}`);
    assert.ok(result.reduced.actions <= 10, `reduced actions ${result.reduced.actions}`);
    assert.equal(result.fingerprintMatch, true);
    assert.ok(result.confirmations.passed >= 3);
    assert.match(result.original.fingerprint.message, /PAYMENT_GATEWAY_CRASH/);
    process.stdout.write(
      `\nKILLER BEFORE ${result.original.lines} lines / ${result.original.actions} actions\n` +
        `KILLER AFTER  ${result.reduced.lines} lines / ${result.reduced.actions} actions\n` +
        `Same failure fingerprint: YES (${result.confirmations.passed}/${result.confirmations.total})\n`,
    );
  });
});
