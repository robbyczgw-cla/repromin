import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Classification, FailureFingerprint, RunRecord } from "./types.js";

export interface CacheKeyInput {
  source: string;
  fingerprint: FailureFingerprint;
  timeoutMs: number;
  confirm: number;
}

export class ExecutionCache {
  private memory = new Map<string, RunRecord>();
  constructor(
    private dir: string | undefined,
    private disabled: boolean,
  ) {}

  key(input: CacheKeyInput): string {
    const h = createHash("sha256");
    h.update(input.source);
    h.update("\n");
    h.update(input.fingerprint.normalizedMessage);
    h.update(input.fingerprint.userRegex ?? "");
    h.update(`\n${input.timeoutMs}:${input.confirm}`);
    return h.digest("hex");
  }

  async get(key: string): Promise<RunRecord | undefined> {
    if (this.disabled) return undefined;
    const mem = this.memory.get(key);
    if (mem) return mem;
    if (!this.dir) return undefined;
    try {
      const raw = await readFile(join(this.dir, `${key}.json`), "utf8");
      const rec = JSON.parse(raw) as RunRecord;
      this.memory.set(key, rec);
      return rec;
    } catch {
      return undefined;
    }
  }

  async set(key: string, rec: RunRecord): Promise<void> {
    if (this.disabled) return;
    this.memory.set(key, rec);
    if (!this.dir) return;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, `${key}.json`), JSON.stringify(rec, null, 2));
  }
}

export function classifyFromRuns(
  expected: FailureFingerprint,
  match: (a: FailureFingerprint, b: FailureFingerprint) => boolean,
  runs: Array<{ ok: boolean; fingerprint?: FailureFingerprint; unresolved?: string; passed?: boolean }>,
): { classification: Classification; reason?: string; fingerprint?: FailureFingerprint } {
  if (runs.some((r) => r.unresolved)) {
    return { classification: "UNRESOLVED", reason: runs.find((r) => r.unresolved)?.unresolved };
  }
  const fps = runs.map((r) => r.fingerprint).filter((f): f is FailureFingerprint => Boolean(f));
  if (runs.every((r) => r.passed)) {
    return { classification: "NOT_INTERESTING", reason: "test passed" };
  }
  if (fps.length === 0) {
    return { classification: "UNRESOLVED", reason: "failed without a parseable error" };
  }
  if (fps.every((fp) => match(expected, fp))) {
    return { classification: "INTERESTING", fingerprint: fps[0] };
  }
  if (fps.some((fp) => match(expected, fp)) && fps.some((fp) => !match(expected, fp))) {
    return { classification: "UNRESOLVED", reason: "inconsistent failure fingerprint across confirmations" };
  }
  return {
    classification: "UNRESOLVED",
    reason: `different failure: ${(fps[0].message.split("\n")[0] ?? "").slice(0, 160)}`,
    fingerprint: fps[0],
  };
}
