#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve, dirname, basename } from "node:path";
import { existsSync } from "node:fs";
import { formatSummary, reduceTest } from "./reduce.js";
import { parsePlaywrightTest } from "./parse.js";
import { readFile } from "node:fs/promises";
import type { ReduceOptions } from "./types.js";

function usage(): string {
  return `ReproMin — shrink a failing Playwright test to the actions that still reproduce the same failure.

Usage:
  repromin <spec.ts> --test <name> [options]

Options:
  --test <name>           Test title (substring or exact). Required if the file has multiple tests.
  --error-regex <re>      Require this regex to match the failure message.
  --confirm <n>           Re-run the minimized test N times (default 1).
  --search-confirm <n>    Confirmations during search (default 1).
  --timeout <ms>          Per-candidate Playwright timeout (default 15000).
  --out <dir>             Output directory (default ./repromin-out).
  --config <file>         Playwright config path (auto-discovered if omitted).
  --max-runs <n>          Safety cap on candidate evaluations (default 200).
  --cache-dir <dir>       Execution cache directory.
  --no-cache              Disable the execution cache.
  --project <name>        Playwright project name.
  --headed                Run browsers headed.
  --keep-assertions       Do not delete expect() statements.
  --dry-run               Parse and list removable actions; do not run the browser.
  --verbose               Print each candidate classification.
  --help                  Show this help.

Example:
  repromin checkout.spec.ts --test "checkout crashes" --confirm 10
`;
}

function discoverConfig(specPath: string): string | undefined {
  let dir = dirname(resolve(specPath));
  for (let i = 0; i < 8; i++) {
    for (const name of ["playwright.config.ts", "playwright.config.js", "playwright.config.mts"]) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        test: { type: "string" },
        "error-regex": { type: "string" },
        confirm: { type: "string", default: "1" },
        "search-confirm": { type: "string" },
        timeout: { type: "string", default: "15000" },
        out: { type: "string", default: "repromin-out" },
        config: { type: "string" },
        "max-runs": { type: "string", default: "200" },
        "cache-dir": { type: "string" },
        "no-cache": { type: "boolean", default: false },
        project: { type: "string" },
        headed: { type: "boolean", default: false },
        "keep-assertions": { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${usage()}`);
    return 2;
  }

  if (parsed.values.help || parsed.positionals.length === 0) {
    process.stdout.write(usage());
    return parsed.values.help ? 0 : 2;
  }

  const specPath = resolve(parsed.positionals[0]);
  if (!existsSync(specPath)) {
    process.stderr.write(`Spec not found: ${specPath}\n`);
    return 2;
  }

  const confirm = Math.max(1, Number(parsed.values.confirm ?? 1));
  const searchConfirm = Math.max(1, Number(parsed.values["search-confirm"] ?? 1));
  const opts: ReduceOptions = {
    specPath,
    testName: parsed.values.test,
    errorRegex: parsed.values["error-regex"],
    confirm,
    searchConfirm,
    timeoutMs: Math.max(1000, Number(parsed.values.timeout ?? 15000)),
    outDir: resolve(parsed.values.out ?? "repromin-out"),
    configPath: parsed.values.config ? resolve(parsed.values.config) : discoverConfig(specPath),
    maxRuns: Math.max(2, Number(parsed.values["max-runs"] ?? 200)),
    cacheDir: parsed.values["cache-dir"] ? resolve(parsed.values["cache-dir"]) : undefined,
    noCache: Boolean(parsed.values["no-cache"]),
    headed: Boolean(parsed.values.headed),
    project: parsed.values.project,
    dryRun: Boolean(parsed.values["dry-run"]),
    keepAssertions: Boolean(parsed.values["keep-assertions"]),
    verbose: Boolean(parsed.values.verbose),
  };

  if (opts.dryRun) {
    const source = await readFile(specPath, "utf8");
    const analyzed = parsePlaywrightTest({
      filePath: specPath,
      source,
      testName: opts.testName,
      keepAssertions: opts.keepAssertions,
    });
    if (analyzed.rejectReason) {
      process.stderr.write(`Rejected: ${analyzed.rejectReason}\n`);
      return 1;
    }
    process.stdout.write(`Test: ${analyzed.testName}\n`);
    process.stdout.write(`Statements: ${analyzed.statements.length}\n`);
    process.stdout.write(`Removable: ${analyzed.removable.length}\n\n`);
    for (const stmt of analyzed.statements) {
      const flag = analyzed.removable.includes(stmt.index) ? "  -" : "  *";
      process.stdout.write(`${flag} [${stmt.index}] ${stmt.summary}\n`);
    }
    return 0;
  }

  const result = await reduceTest(opts);
  process.stdout.write(formatSummary(result) + "\n");
  if (result.rejectReason) return 1;
  if (!result.fingerprintMatch) return 1;
  if (result.confirmations.passed < result.confirmations.total) return 1;
  return 0;
}

export function isCliEntry(argv1: string | undefined, modulePath: string): boolean {
  if (!argv1) return false;
  const entry = resolve(argv1);
  if (entry === resolve(modulePath)) return true;
  const base = basename(entry);
  return base === "repromin" || base === "cli.js" || base === "cli.ts";
}

if (isCliEntry(process.argv[1], new URL(import.meta.url).pathname)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${err?.stack ?? err}\n`);
      process.exit(1);
    },
  );
}

export { main };
