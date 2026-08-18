import { spawn } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildFingerprint } from "./fingerprint.js";
import type { FailureFingerprint } from "./types.js";

export interface PlaywrightRunOptions {
  source: string;
  originalSpecPath: string;
  testName: string;
  configPath?: string;
  timeoutMs: number;
  headed: boolean;
  project?: string;
  userRegex?: string;
}

export interface PlaywrightRunResult {
  passed: boolean;
  failed: boolean;
  unresolved?: string;
  fingerprint?: FailureFingerprint;
  rawMessage?: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

interface JsonReport {
  suites?: JsonSuite[];
  errors?: Array<{ message?: string; stack?: string }>;
}

interface JsonSuite {
  title?: string;
  file?: string;
  suites?: JsonSuite[];
  specs?: JsonSpec[];
}

interface JsonSpec {
  title?: string;
  ok?: boolean;
  tests?: Array<{
    results?: Array<{
      status?: string;
      error?: { message?: string; stack?: string };
      errors?: Array<{ message?: string; stack?: string }>;
    }>;
  }>;
}

export async function runPlaywrightCandidate(opts: PlaywrightRunOptions): Promise<PlaywrightRunResult> {
  const started = Date.now();
  // Candidates must live next to the original spec so they stay inside the
  // project's testDir. A /tmp file is invisible to Playwright and reports
  // "No tests found", which must never look like a fingerprint match.
  const specDir = dirname(resolve(opts.originalSpecPath));
  const dir = await mkdtemp(join(tmpdir(), "repromin-"));
  const specPath = join(specDir, `.repromin-${process.pid}-${started}.spec.ts`);
  const reportPath = join(dir, "report.json");
  await writeFile(specPath, opts.source, "utf8");

  const args = [
    "playwright",
    "test",
    specPath,
    `--timeout=${opts.timeoutMs}`,
    "--retries=0",
    "--workers=1",
    "--reporter=json",
    `--grep=${escapeRegex(opts.testName)}`,
  ];
  if (opts.configPath) args.push(`--config=${resolve(opts.configPath)}`);
  if (opts.headed) args.push("--headed");
  if (opts.project) args.push(`--project=${opts.project}`);

  const cwd = opts.configPath ? dirname(resolve(opts.configPath)) : dirname(resolve(opts.originalSpecPath));

  let stdout = "";
  let stderr = "";
  let code = 1;
  try {
    const result = await runCommand("npx", args, {
      cwd,
      timeoutMs: opts.timeoutMs + 30_000,
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
      },
    });
    stdout = result.stdout;
    stderr = result.stderr;
    code = result.code;
  } finally {
    await rm(specPath, { force: true }).catch(() => undefined);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  if (/no tests (found|found\.)/i.test(stdout + stderr)) {
    return {
      passed: false,
      failed: false,
      unresolved: "playwright ran zero matching tests",
      exitCode: code,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  // Prefer the printed error: many projects pin reporter in config and
  // ignore --reporter=json. JSON is a fallback when it is actually emitted.
  const fromText = extractFailureFromOutput(stdout, stderr);
  const report = parseReport(stdout) ?? (await readReportFile(reportPath));
  const extracted = fromText.message || fromText.passed ? fromText : extractFailure(report, opts.testName);

  if (!report && /SyntaxError|Cannot find module|Error: Cannot find/i.test(stderr + stdout)) {
    return {
      passed: false,
      failed: false,
      unresolved: firstLine(stderr || stdout) || "syntax or load error",
      exitCode: code,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  if (extracted.noTests) {
    return {
      passed: false,
      failed: false,
      unresolved: extracted.unresolved ?? "no tests ran",
      exitCode: code,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  if (extracted.passed) {
    return {
      passed: true,
      failed: false,
      exitCode: code,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  if (extracted.message) {
    const fingerprint = buildFingerprint({
      message: extracted.message,
      stack: extracted.stack,
      userRegex: opts.userRegex,
    });
    return {
      passed: false,
      failed: true,
      fingerprint,
      rawMessage: extracted.message,
      exitCode: code,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  return {
    passed: false,
    failed: false,
    unresolved: extracted.unresolved ?? "could not extract a failure message",
    exitCode: code,
    stdout,
    stderr,
    durationMs: Date.now() - started,
  };
}

async function readReportFile(path: string): Promise<JsonReport | undefined> {
  try {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(path, "utf8")) as JsonReport;
  } catch {
    return undefined;
  }
}

function parseReport(stdout: string): JsonReport | undefined {
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("{")) {
    const idx = trimmed.lastIndexOf("\n{");
    if (idx >= 0) {
      try {
        return JSON.parse(trimmed.slice(idx + 1)) as JsonReport;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as JsonReport;
  } catch {
    return undefined;
  }
}

function extractFailureFromOutput(
  stdout: string,
  stderr: string,
): { passed?: boolean; message?: string; stack?: string; noTests?: boolean; unresolved?: string } {
  const text = `${stdout}\n${stderr}`;
  if (/Error:\s*No tests found/i.test(text) || /no tests found/i.test(text)) {
    return { noTests: true, unresolved: "playwright ran zero matching tests" };
  }
  const err = text.match(
    /((?:Error|TimeoutError|AssertionError|TypeError|ReferenceError):[\s\S]+?)(?:\n\s*Error Context:|\n\s+\d+\) |\n\s+\d+ failed|\n\s+\d+ passed|$)/,
  );
  if (err) {
    const block = err[1].replace(/^\s+/gm, "").trim();
    const stackMatch = text.match(/\n\s+at .+(?:\n\s+at .+)+/);
    return { message: block, stack: stackMatch?.[0] };
  }
  if (/\d+ passed/i.test(text) && !/\d+ failed/i.test(text)) {
    return { passed: true };
  }
  return {};
}

function extractFailure(
  report: JsonReport | undefined,
  testName: string,
): { passed?: boolean; message?: string; stack?: string; noTests?: boolean; unresolved?: string } {
  if (!report) return { noTests: true, unresolved: "missing playwright json report" };

  const specs: JsonSpec[] = [];
  const walk = (suite?: JsonSuite) => {
    if (!suite) return;
    for (const s of suite.specs ?? []) specs.push(s);
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites ?? []) walk(s);

  const matching = specs.filter((s) => (s.title ?? "").includes(testName) || testName.includes(s.title ?? ""));
  const pool = matching.length > 0 ? matching : specs;

  if (pool.length === 0) {
    const top = report.errors?.[0];
    if (top?.message) return { message: top.message, stack: top.stack };
    return { noTests: true, unresolved: "playwright ran zero matching tests" };
  }

  const results = pool.flatMap((s) => s.tests ?? []).flatMap((t) => t.results ?? []);
  if (results.length === 0) return { noTests: true, unresolved: "test had no results" };

  const failed = results.find((r) => r.status === "failed" || r.status === "timedOut" || r.status === "interrupted");
  if (failed) {
    const err = failed.error ?? failed.errors?.[0];
    if (err?.message) return { message: err.message, stack: err.stack };
    return { unresolved: `test ${failed.status} without an error message` };
  }

  if (results.every((r) => r.status === "passed" || r.status === "skipped")) {
    if (results.every((r) => r.status === "skipped")) {
      return { noTests: true, unresolved: "test was skipped" };
    }
    return { passed: true };
  }

  return { unresolved: `unhandled status: ${results.map((r) => r.status).join(",")}` };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstLine(s: string): string {
  return s.trim().split("\n")[0] ?? "";
}

function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; env: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
    }, opts.timeoutMs);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolvePromise({ stdout, stderr, code: code ?? 1 });
    });
    child.on("error", (err) => {
      clearTimeout(killer);
      resolvePromise({ stdout, stderr: stderr + "\n" + err.message, code: 1 });
    });
  });
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeOutFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export async function cleanupDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
