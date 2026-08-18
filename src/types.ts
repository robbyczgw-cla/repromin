export type Classification = "INTERESTING" | "NOT_INTERESTING" | "UNRESOLVED";

export type StatementKind = "action" | "assertion" | "binding" | "keep" | "complex";

export interface SourceRange {
  start: number;
  end: number;
  fullStart: number;
}

export interface TestStatement {
  index: number;
  kind: StatementKind;
  text: string;
  start: number;
  end: number;
  fullStart: number;
  defined: string[];
  used: string[];
  summary: string;
}

export interface AnalyzedTest {
  filePath: string;
  source: string;
  testName: string;
  testTitleLiteral: string;
  bodyStart: number;
  bodyEnd: number;
  statements: TestStatement[];
  removable: number[];
  ambientNames: string[];
  rejectReason?: string;
}

export interface FailureFingerprint {
  errorName: string;
  message: string;
  normalizedMessage: string;
  matcher?: string;
  locatorHint?: string;
  stackLocation?: string;
  userRegex?: string;
}

export interface RunRecord {
  classification: Classification;
  fingerprint?: FailureFingerprint;
  rawMessage?: string;
  durationMs: number;
  exitCode: number;
  reason?: string;
}

export interface ReduceOptions {
  specPath: string;
  testName?: string;
  errorRegex?: string;
  confirm: number;
  searchConfirm: number;
  timeoutMs: number;
  outDir: string;
  configPath?: string;
  maxRuns: number;
  cacheDir?: string;
  noCache: boolean;
  headed: boolean;
  project?: string;
  dryRun: boolean;
  keepAssertions: boolean;
  verbose: boolean;
  workers?: number;
}

export interface ExecutionLogEntry {
  n: number;
  classification: Classification;
  actionCount: number;
  kept: number[];
  reason?: string;
  durationMs: number;
  cached: boolean;
}

export interface RetainedDependency {
  summary: string;
  reason: string;
}

export interface ReduceResult {
  ok: boolean;
  rejectReason?: string;
  original: {
    lines: number;
    actions: number;
    source: string;
    fingerprint: FailureFingerprint;
  };
  reduced?: {
    lines: number;
    actions: number;
    source: string;
    statements: TestStatement[];
    keptRemovable: number[];
  };
  fingerprintMatch: boolean;
  confirmations: { passed: number; total: number };
  runs: number;
  cacheHits: number;
  durationMs: number;
  log: ExecutionLogEntry[];
  retained: RetainedDependency[];
  outDir: string;
  minimizedPath?: string;
  reportPath?: string;
}

export interface CandidateEval {
  classification: Classification;
  fingerprint?: FailureFingerprint;
  reason?: string;
  durationMs: number;
  cached: boolean;
  source: string;
  keptRemovable: number[];
  keptStatements: TestStatement[];
}
