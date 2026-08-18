import { writeOutFile } from "./runner.js";
import { describeFingerprint } from "./fingerprint.js";
import type { ReduceResult } from "./types.js";

export async function writeReport(result: ReduceResult): Promise<void> {
  if (!result.reportPath) return;
  const md = renderReport(result);
  await writeOutFile(result.reportPath, md);
  await writeOutFile(
    result.reportPath.replace(/report\.md$/, "benchmark.json"),
    JSON.stringify(toBenchmark(result), null, 2) + "\n",
  );
}

export function renderReport(result: ReduceResult): string {
  const orig = result.original;
  const red = result.reduced;
  const ratio =
    red && orig.actions > 0 ? (100 * (1 - red.actions / orig.actions)).toFixed(1) : "n/a";
  const lines = [
    "# ReproMin report",
    "",
    result.rejectReason ? `**Rejected:** ${result.rejectReason}` : "**Status:** completed",
    "",
    "## Before / after",
    "",
    "| | Before | After |",
    "| --- | ---: | ---: |",
    `| Lines | ${orig.lines} | ${red?.lines ?? "—"} |`,
    `| Actions | ${orig.actions} | ${red?.actions ?? "—"} |`,
    `| Reduction |  | ${ratio}% |`,
    "",
    "## Failure fingerprint",
    "",
    "```",
    describeFingerprint(orig.fingerprint),
    "",
    orig.fingerprint.message.split("\n").slice(0, 12).join("\n"),
    "```",
    "",
    `Same failure fingerprint: **${result.fingerprintMatch ? "YES" : "NO"}**`,
    "",
    `Confirmed: **${result.confirmations.passed}/${result.confirmations.total}**`,
    "",
    "## Performance",
    "",
    `- Browser runs: ${result.runs}`,
    `- Cache hits: ${result.cacheHits}`,
    `- Wall time: ${(result.durationMs / 1000).toFixed(1)}s`,
    "",
    "## Retained dependencies",
    "",
  ];

  if (result.retained.length === 0) {
    lines.push("_None reported._", "");
  } else {
    for (const dep of result.retained) {
      lines.push(`- \`${dep.summary}\` — ${dep.reason}`);
    }
    lines.push("");
  }

  if (red) {
    lines.push("## Minimized test", "", "```ts", red.source.trimEnd(), "```", "");
  }

  lines.push("## Candidate log", "", "| # | Class | Actions | Cached | Reason |", "| ---: | --- | ---: | --- | --- |");
  for (const e of result.log) {
    lines.push(
      `| ${e.n} | ${e.classification} | ${e.actionCount} | ${e.cached ? "yes" : ""} | ${(e.reason ?? "").replace(/\|/g, "/")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function toBenchmark(result: ReduceResult) {
  return {
    ok: result.ok,
    originalActions: result.original.actions,
    originalLines: result.original.lines,
    reducedActions: result.reduced?.actions ?? null,
    reducedLines: result.reduced?.lines ?? null,
    reductionRatio:
      result.reduced && result.original.actions > 0
        ? 1 - result.reduced.actions / result.original.actions
        : null,
    fingerprintMatch: result.fingerprintMatch,
    confirmations: result.confirmations,
    runs: result.runs,
    cacheHits: result.cacheHits,
    durationMs: result.durationMs,
  };
}
