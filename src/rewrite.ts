import type { AnalyzedTest, TestStatement } from "./types.js";

export interface RewriteResult {
  source: string;
  keptStatements: TestStatement[];
  keptRemovable: number[];
  unresolvedReason?: string;
}

/**
 * Build a candidate by deleting removable statements not in `keep`.
 * Bindings are auto-kept when a remaining statement uses them (transitive).
 * Structurally invalid subsets are marked UNRESOLVED without running.
 */
export function rewriteCandidate(analyzed: AnalyzedTest, keepRemovable: number[]): RewriteResult {
  const keepSet = new Set(keepRemovable);
  const wanted = new Set<number>();

  for (const stmt of analyzed.statements) {
    if (stmt.kind === "keep") wanted.add(stmt.index);
    if (stmt.kind === "assertion" && !analyzed.removable.includes(stmt.index)) wanted.add(stmt.index);
    if (analyzed.removable.includes(stmt.index) && keepSet.has(stmt.index)) wanted.add(stmt.index);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const used = new Set<string>();
    for (const idx of wanted) {
      for (const name of analyzed.statements[idx].used) used.add(name);
    }
    for (const stmt of analyzed.statements) {
      if (wanted.has(stmt.index)) continue;
      if (stmt.kind !== "binding") continue;
      if (stmt.defined.some((d) => used.has(d))) {
        wanted.add(stmt.index);
        changed = true;
      }
    }
  }

  const ambient = new Set(analyzed.ambientNames);
  const defined = new Set<string>();
  for (const name of ambient) defined.add(name);
  for (const stmt of analyzed.statements) {
    if (!wanted.has(stmt.index)) continue;
    for (const name of stmt.defined) defined.add(name);
  }

  for (const stmt of analyzed.statements) {
    if (!wanted.has(stmt.index)) continue;
    const missing = stmt.used.filter((n) => !defined.has(n) && !isProbablyGlobal(n));
    if (missing.length > 0) {
      return {
        source: analyzed.source,
        keptStatements: analyzed.statements.filter((s) => wanted.has(s.index)),
        keptRemovable: keepRemovable.slice(),
        unresolvedReason: `Missing names ${missing.join(", ")} for: ${stmt.summary}`,
      };
    }
  }

  const keptStatements = analyzed.statements.filter((s) => wanted.has(s.index));
  const indent = inferIndent(analyzed);
  const inner =
    keptStatements.length === 0
      ? "\n"
      : "\n" + keptStatements.map((s) => `${indent}${s.text}`).join("\n") + "\n  ";
  const source =
    analyzed.source.slice(0, analyzed.bodyStart + 1) + inner + analyzed.source.slice(analyzed.bodyEnd - 1);

  return {
    source,
    keptStatements,
    keptRemovable: keepRemovable.slice().sort((a, b) => a - b),
  };
}

function inferIndent(analyzed: AnalyzedTest): string {
  const first = analyzed.statements[0];
  if (!first) return "    ";
  const lineStart = analyzed.source.lastIndexOf("\n", first.start - 1) + 1;
  const prefix = analyzed.source.slice(lineStart, first.start);
  return prefix.length > 0 ? prefix : "    ";
}

function isProbablyGlobal(name: string): boolean {
  return /^[A-Z]/.test(name) || name.startsWith("_");
}

export function countActions(statements: TestStatement[]): number {
  return statements.filter((s) => s.kind === "action" || s.kind === "assertion").length;
}

export function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split(/\r?\n/).length;
}
