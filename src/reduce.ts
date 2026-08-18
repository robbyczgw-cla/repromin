import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { classifyFromRuns, ExecutionCache } from "./cache.js";
import { BudgetExceeded, coarseChunks, ddmin, prefixChop } from "./ddmin.js";
import { describeFingerprint, fingerprintsMatch, isUnusableFailure } from "./fingerprint.js";
import { parsePlaywrightTest } from "./parse.js";
import { writeReport } from "./report.js";
import { countActions, countLines, rewriteCandidate } from "./rewrite.js";
import { runPlaywrightCandidate, writeOutFile } from "./runner.js";
import type {
  AnalyzedTest,
  CandidateEval,
  ExecutionLogEntry,
  FailureFingerprint,
  ReduceOptions,
  ReduceResult,
  RetainedDependency,
  RunRecord,
  TestStatement,
} from "./types.js";

export async function reduceTest(opts: ReduceOptions): Promise<ReduceResult> {
  const started = Date.now();
  const specPath = resolve(opts.specPath);
  const source = await readFile(specPath, "utf8");
  const analyzed = parsePlaywrightTest({
    filePath: specPath,
    source,
    testName: opts.testName,
    keepAssertions: opts.keepAssertions,
  });

  const log: ExecutionLogEntry[] = [];
  const outDir = resolve(opts.outDir);

  if (analyzed.rejectReason) {
    return {
      ok: false,
      rejectReason: analyzed.rejectReason,
      original: {
        lines: countLines(source),
        actions: 0,
        source,
        fingerprint: {
          errorName: "Error",
          message: analyzed.rejectReason,
          normalizedMessage: analyzed.rejectReason,
        },
      },
      fingerprintMatch: false,
      confirmations: { passed: 0, total: 0 },
      runs: 0,
      cacheHits: 0,
      durationMs: Date.now() - started,
      log,
      retained: [],
      outDir,
    };
  }

  if (opts.dryRun) {
    const dummyFp: FailureFingerprint = {
      errorName: "Error",
      message: "(dry-run)",
      normalizedMessage: "(dry-run)",
    };
    return {
      ok: true,
      original: {
        lines: countLines(source),
        actions: analyzed.removable.length,
        source,
        fingerprint: dummyFp,
      },
      fingerprintMatch: false,
      confirmations: { passed: 0, total: 0 },
      runs: 0,
      cacheHits: 0,
      durationMs: Date.now() - started,
      log,
      retained: [],
      outDir,
    };
  }

  const cache = new ExecutionCache(opts.noCache ? undefined : opts.cacheDir ?? join(outDir, "cache"), opts.noCache);
  let runs = 0;
  let cacheHits = 0;
  const unresolvedRemoval = new Map<number, string>();

  const evaluate = async (
    keepRemovable: number[],
    confirm: number,
    label: string,
    allowCache = true,
  ): Promise<CandidateEval> => {
    const rewritten = rewriteCandidate(analyzed, keepRemovable);
    if (rewritten.unresolvedReason) {
      const entry: ExecutionLogEntry = {
        n: ++runs,
        classification: "UNRESOLVED",
        actionCount: rewritten.keptRemovable.length,
        kept: rewritten.keptRemovable,
        reason: rewritten.unresolvedReason,
        durationMs: 0,
        cached: false,
      };
      log.push(entry);
      return {
        classification: "UNRESOLVED",
        reason: rewritten.unresolvedReason,
        durationMs: 0,
        cached: false,
        source: rewritten.source,
        keptRemovable: rewritten.keptRemovable,
        keptStatements: rewritten.keptStatements,
      };
    }

    const evals: Array<{ ok: boolean; fingerprint?: FailureFingerprint; unresolved?: string; passed?: boolean }> = [];
    let durationMs = 0;
    let cached = true;
    let lastRec: RunRecord | undefined;

    for (let i = 0; i < confirm; i++) {
      const key = cache.key({
        source: rewritten.source,
        fingerprint: targetFingerprint,
        timeoutMs: opts.timeoutMs,
        confirm: 1,
      });
      let rec = allowCache && i === 0 && targetFingerprint.message ? await cache.get(key) : undefined;
      if (rec) {
        cacheHits++;
      } else {
        cached = false;
        const result = await runPlaywrightCandidate({
          source: rewritten.source,
          originalSpecPath: specPath,
          testName: analyzed.testName,
          configPath: opts.configPath,
          timeoutMs: opts.timeoutMs,
          headed: opts.headed,
          project: opts.project,
          userRegex: opts.errorRegex,
        });
        rec = {
          classification: result.passed ? "NOT_INTERESTING" : result.unresolved ? "UNRESOLVED" : "INTERESTING",
          fingerprint: result.fingerprint,
          rawMessage: result.rawMessage,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          reason: result.unresolved ?? (result.passed ? "test passed" : undefined),
        };
        if (allowCache && targetFingerprint.message) await cache.set(key, rec);
      }
      lastRec = rec;
      durationMs += rec.durationMs;
      evals.push({
        ok: rec.classification === "INTERESTING",
        fingerprint: rec.fingerprint,
        unresolved: !rec.fingerprint && rec.reason && rec.reason !== "test passed" ? rec.reason : undefined,
        passed: rec.reason === "test passed" || (rec.classification === "NOT_INTERESTING" && !rec.fingerprint),
      });
    }

    const classified = classifyFromRuns(targetFingerprint, fingerprintsMatch, evals);
    log.push({
      n: ++runs,
      classification: classified.classification,
      actionCount: rewritten.keptRemovable.length,
      kept: rewritten.keptRemovable,
      reason: classified.reason ?? label,
      durationMs,
      cached,
    });
    if (opts.verbose) {
      const mark = classified.classification.padEnd(16);
      process.stderr.write(
        `[${String(runs).padStart(3)}] ${mark} ${rewritten.keptRemovable.length} actions  ${classified.reason ?? ""}\n`,
      );
    }
    void lastRec;
    return {
      classification: classified.classification,
      fingerprint: classified.fingerprint,
      reason: classified.reason,
      durationMs,
      cached,
      source: rewritten.source,
      keptRemovable: rewritten.keptRemovable,
      keptStatements: rewritten.keptStatements,
    };
  };

  // Placeholder until original is classified.
  let targetFingerprint: FailureFingerprint = {
    errorName: "Error",
    message: "",
    normalizedMessage: "",
    userRegex: opts.errorRegex,
  };

  const originalEval = await evaluateOriginal(analyzed, opts, specPath);
  runs += 1;
  log.push({
    n: 1,
    classification: originalEval.classification,
    actionCount: analyzed.removable.length,
    kept: analyzed.removable.slice(),
    reason: originalEval.reason ?? "original",
    durationMs: originalEval.durationMs,
    cached: false,
  });

  if (originalEval.classification !== "INTERESTING" || !originalEval.fingerprint) {
    return {
      ok: false,
      rejectReason: `Original test is not a usable failure: ${originalEval.reason ?? originalEval.classification}`,
      original: {
        lines: countLines(source),
        actions: analyzed.removable.length,
        source,
        fingerprint: originalEval.fingerprint ?? targetFingerprint,
      },
      fingerprintMatch: false,
      confirmations: { passed: 0, total: opts.confirm },
      runs,
      cacheHits,
      durationMs: Date.now() - started,
      log,
      retained: [],
      outDir,
    };
  }

  targetFingerprint = { ...originalEval.fingerprint, userRegex: opts.errorRegex };
  if (opts.errorRegex) {
    if (!new RegExp(opts.errorRegex).test(targetFingerprint.message)) {
      return {
        ok: false,
        rejectReason: `Original failure does not match --error-regex ${JSON.stringify(opts.errorRegex)}:\n${targetFingerprint.message}`,
        original: {
          lines: countLines(source),
          actions: analyzed.removable.length,
          source,
          fingerprint: targetFingerprint,
        },
        fingerprintMatch: false,
        confirmations: { passed: 0, total: opts.confirm },
        runs,
        cacheHits,
        durationMs: Date.now() - started,
        log,
        retained: [],
        outDir,
      };
    }
  }

  if (opts.verbose) {
    process.stderr.write(`Original fingerprint: ${describeFingerprint(targetFingerprint)}\n`);
    process.stderr.write(`Removable units: ${analyzed.removable.length}\n`);
  }

  const pred = async (subset: number[]) => {
    const ev = await evaluate(subset, opts.searchConfirm, "candidate");
    if (ev.classification === "UNRESOLVED") {
      const dropped = analyzed.removable.filter((i) => !subset.includes(i));
      for (const idx of dropped) {
        if (!unresolvedRemoval.has(idx)) {
          unresolvedRemoval.set(idx, ev.reason ?? "unresolved without this action");
        }
      }
    }
    return ev.classification;
  };

  let kept = analyzed.removable.slice();
  try {
    kept = await prefixChop(kept, {
      pred,
      maxEvals: Math.max(1, opts.maxRuns - runs),
    });
    kept = await coarseChunks(kept, {
      pred,
      maxEvals: Math.max(1, opts.maxRuns - runs),
    });
    kept = await ddmin(kept, {
      pred,
      maxEvals: Math.max(1, opts.maxRuns - runs),
    });
  } catch (err) {
    if (!(err instanceof BudgetExceeded)) throw err;
    if (opts.verbose) process.stderr.write(`${err.message}; using best set so far.\n`);
  }

  const reducedEval = await evaluate(kept, 1, "final", true);
  let confirmPassed = reducedEval.classification === "INTERESTING" ? 1 : 0;
  if (opts.confirm > 1) {
    for (let i = 1; i < opts.confirm; i++) {
      const ev = await evaluate(kept, 1, `confirm ${i + 1}/${opts.confirm}`, false);
      if (ev.classification === "INTERESTING") confirmPassed++;
    }
  }

  const reducedSource = reducedEval.source;
  const minimizedPath = join(outDir, minimizedName(specPath));
  await writeOutFile(minimizedPath, reducedSource);

  const retained = describeRetained(analyzed, kept, unresolvedRemoval);
  const reportPath = join(outDir, "report.md");
  const result: ReduceResult = {
    ok: reducedEval.classification === "INTERESTING" && confirmPassed === Math.max(opts.confirm, 1),
    original: {
      lines: countLines(source),
      actions: analyzed.removable.length,
      source,
      fingerprint: targetFingerprint,
    },
    reduced: {
      lines: countLines(reducedSource),
      actions: countActions(reducedEval.keptStatements),
      source: reducedSource,
      statements: reducedEval.keptStatements,
      keptRemovable: kept,
    },
    fingerprintMatch: reducedEval.classification === "INTERESTING",
    confirmations: { passed: confirmPassed, total: Math.max(opts.confirm, 1) },
    runs,
    cacheHits,
    durationMs: Date.now() - started,
    log,
    retained,
    outDir,
    minimizedPath,
    reportPath,
  };
  await writeReport(result);
  return result;
}

async function evaluateOriginal(
  analyzed: AnalyzedTest,
  opts: ReduceOptions,
  specPath: string,
): Promise<{ classification: "INTERESTING" | "NOT_INTERESTING" | "UNRESOLVED"; fingerprint?: FailureFingerprint; reason?: string; durationMs: number }> {
  const result = await runPlaywrightCandidate({
    source: analyzed.source,
    originalSpecPath: specPath,
    testName: analyzed.testName,
    configPath: opts.configPath,
    timeoutMs: opts.timeoutMs,
    headed: opts.headed,
    project: opts.project,
    userRegex: opts.errorRegex,
  });
  if (result.passed) {
    return { classification: "NOT_INTERESTING", reason: "original test passed", durationMs: result.durationMs };
  }
  if (result.unresolved || !result.fingerprint || isUnusableFailure(result.fingerprint.message)) {
    return {
      classification: "UNRESOLVED",
      reason: result.unresolved ?? "original produced no fingerprint",
      durationMs: result.durationMs,
    };
  }
  return { classification: "INTERESTING", fingerprint: result.fingerprint, durationMs: result.durationMs };
}

function minimizedName(specPath: string): string {
  const base = basename(specPath);
  if (base.endsWith(".spec.ts")) return base.replace(/\.spec\.ts$/, ".min.spec.ts");
  if (base.endsWith(".ts")) return base.replace(/\.ts$/, ".min.ts");
  return `${base}.min.spec.ts`;
}

function describeRetained(
  analyzed: AnalyzedTest,
  kept: number[],
  unresolvedRemoval: Map<number, string>,
): RetainedDependency[] {
  const out: RetainedDependency[] = [];
  const keepSet = new Set(kept);
  const rewritten = rewriteCandidate(analyzed, kept);
  for (const stmt of rewritten.keptStatements) {
    if (stmt.kind === "binding") {
      out.push({ summary: stmt.summary, reason: "variable used by a retained statement" });
    }
  }
  for (const idx of analyzed.removable) {
    if (!keepSet.has(idx)) continue;
    const reason = unresolvedRemoval.get(idx);
    const stmt = analyzed.statements[idx];
    if (reason) {
      out.push({ summary: stmt.summary, reason: `removal was UNRESOLVED: ${reason}` });
    }
  }
  return out;
}

export function formatSummary(result: ReduceResult): string {
  const lines: string[] = [];
  lines.push("ReproMin v0.1");
  if (result.rejectReason) {
    lines.push(`Rejected: ${result.rejectReason}`);
    return lines.join("\n");
  }
  lines.push("");
  lines.push("BEFORE");
  lines.push(`${result.original.lines} lines`);
  lines.push(`${result.original.actions} actions`);
  lines.push("");
  if (result.reduced) {
    lines.push("AFTER");
    lines.push(`${result.reduced.lines} lines`);
    lines.push(`${result.reduced.actions} actions`);
    lines.push("");
  }
  lines.push(`Same failure fingerprint: ${result.fingerprintMatch ? "YES" : "NO"}`);
  lines.push(`Confirmed: ${result.confirmations.passed}/${result.confirmations.total}`);
  lines.push(`Runs: ${result.runs}  (cache hits ${result.cacheHits})`);
  lines.push(`Time: ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.minimizedPath) lines.push(`Wrote: ${result.minimizedPath}`);
  if (result.reportPath) lines.push(`Report: ${result.reportPath}`);
  return lines.join("\n");
}

/** Exported for tests that want to evaluate a subset without the full CLI. */
export async function evaluateSubset(
  analyzed: AnalyzedTest,
  keepRemovable: number[],
  opts: {
    specPath: string;
    expected: FailureFingerprint;
    configPath?: string;
    timeoutMs: number;
    headed?: boolean;
    errorRegex?: string;
  },
): Promise<CandidateEval> {
  const rewritten = rewriteCandidate(analyzed, keepRemovable);
  if (rewritten.unresolvedReason) {
    return {
      classification: "UNRESOLVED",
      reason: rewritten.unresolvedReason,
      durationMs: 0,
      cached: false,
      source: rewritten.source,
      keptRemovable: rewritten.keptRemovable,
      keptStatements: rewritten.keptStatements,
    };
  }
  const result = await runPlaywrightCandidate({
    source: rewritten.source,
    originalSpecPath: opts.specPath,
    testName: analyzed.testName,
    configPath: opts.configPath,
    timeoutMs: opts.timeoutMs,
    headed: Boolean(opts.headed),
    userRegex: opts.errorRegex,
  });
  if (result.passed) {
    return {
      classification: "NOT_INTERESTING",
      reason: "test passed",
      durationMs: result.durationMs,
      cached: false,
      source: rewritten.source,
      keptRemovable: rewritten.keptRemovable,
      keptStatements: rewritten.keptStatements,
    };
  }
  if (result.unresolved || !result.fingerprint) {
    return {
      classification: "UNRESOLVED",
      reason: result.unresolved ?? "no fingerprint",
      durationMs: result.durationMs,
      cached: false,
      source: rewritten.source,
      keptRemovable: rewritten.keptRemovable,
      keptStatements: rewritten.keptStatements,
    };
  }
  const same = fingerprintsMatch(opts.expected, result.fingerprint);
  return {
    classification: same ? "INTERESTING" : "UNRESOLVED",
    fingerprint: result.fingerprint,
    reason: same ? undefined : `different failure: ${describeFingerprint(result.fingerprint)}`,
    durationMs: result.durationMs,
    cached: false,
    source: rewritten.source,
    keptRemovable: rewritten.keptRemovable,
    keptStatements: rewritten.keptStatements,
  };
}

export type { AnalyzedTest, TestStatement };
