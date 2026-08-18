import ts from "typescript";
import type { AnalyzedTest, StatementKind, TestStatement } from "./types.js";

const ACTION_METHODS = new Set([
  "goto",
  "click",
  "dblclick",
  "fill",
  "press",
  "check",
  "uncheck",
  "selectOption",
  "hover",
  "type",
  "tap",
  "focus",
  "blur",
  "setInputFiles",
  "dragTo",
  "waitForSelector",
  "waitForURL",
  "waitForLoadState",
  "waitForTimeout",
  "waitForFunction",
  "waitForEvent",
  "waitForResponse",
  "waitForRequest",
  "waitFor",
  "reload",
  "goBack",
  "goForward",
  "setViewportSize",
  "bringToFront",
  "dispatchEvent",
  "setChecked",
  "clear",
  "selectText",
  "scrollIntoViewIfNeeded",
]);

const CONTROL_FLOW_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.SwitchStatement,
]);

const AMBIENT = new Set([
  "page",
  "context",
  "browser",
  "request",
  "expect",
  "test",
  "console",
  "Date",
  "Math",
  "JSON",
  "Number",
  "String",
  "Boolean",
  "Array",
  "Object",
  "Promise",
  "undefined",
  "null",
  "true",
  "false",
]);

export interface ParseOptions {
  filePath: string;
  source: string;
  testName?: string;
  keepAssertions?: boolean;
}

interface TestCall {
  name: string;
  node: ts.CallExpression;
  body: ts.Block;
  params: string[];
}

export function parsePlaywrightTest(opts: ParseOptions): AnalyzedTest {
  const sourceFile = ts.createSourceFile(
    opts.filePath,
    opts.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const tests = collectTestCalls(sourceFile);
  if (tests.length === 0) {
    return rejected(opts, "No Playwright test() calls found.");
  }

  const selected = selectTest(tests, opts.testName);
  if (!selected.ok) {
    return rejected(opts, selected.reason);
  }

  const test = selected.test;
  const reject = rejectIfUnsupported(test.body, opts.source);
  if (reject) {
    return rejected(opts, reject, test.name);
  }

  const ambientNames = [...AMBIENT, ...test.params];
  const statements: TestStatement[] = test.body.statements.map((stmt, index) =>
    classifyStatement(stmt, index, opts.source, sourceFile),
  );

  const complex = statements.find((s) => s.kind === "complex");
  if (complex) {
    return rejected(
      opts,
      `Unsupported statement in test body (${complex.summary}). v0.1 only reduces straight-line Playwright actions.`,
      test.name,
    );
  }

  const removable = statements
    .filter((s) => s.kind === "action" || (s.kind === "assertion" && !opts.keepAssertions))
    .map((s) => s.index);

  if (removable.length === 0) {
    return rejected(
      opts,
      "No removable Playwright action/assertion statements found in the test body.",
      test.name,
    );
  }

  return {
    filePath: opts.filePath,
    source: opts.source,
    testName: test.name,
    testTitleLiteral: test.name,
    bodyStart: test.body.getStart(sourceFile),
    bodyEnd: test.body.getEnd(),
    statements,
    removable,
    ambientNames,
  };
}

function rejected(opts: ParseOptions, reason: string, testName = opts.testName ?? ""): AnalyzedTest {
  return {
    filePath: opts.filePath,
    source: opts.source,
    testName,
    testTitleLiteral: testName,
    bodyStart: 0,
    bodyEnd: 0,
    statements: [],
    removable: [],
    ambientNames: [...AMBIENT],
    rejectReason: reason,
  };
}

function collectTestCalls(sourceFile: ts.SourceFile): TestCall[] {
  const found: TestCall[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isTestFn(node.expression)) {
      const name = stringLiteralArg(node.arguments[0]);
      const fn = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
      if (name && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.body && ts.isBlock(fn.body)) {
        found.push({
          name,
          node,
          body: fn.body,
          params: extractParamNames(fn),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

function isTestFn(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr) && expr.text === "test") return true;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "test") {
    return expr.name.text === "only" || expr.name.text === "fixme";
  }
  return false;
}

function stringLiteralArg(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function extractParamNames(fn: ts.ArrowFunction | ts.FunctionExpression): string[] {
  const names: string[] = [];
  for (const p of fn.parameters) {
    collectBindingNames(p.name, names);
  }
  return names;
}

function collectBindingNames(name: ts.BindingName, into: string[]) {
  if (ts.isIdentifier(name)) {
    into.push(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) {
      if (ts.isBindingElement(el)) collectBindingNames(el.name, into);
    }
  }
}

function selectTest(
  tests: TestCall[],
  testName?: string,
): { ok: true; test: TestCall } | { ok: false; reason: string } {
  if (!testName) {
    if (tests.length === 1) return { ok: true, test: tests[0] };
    return {
      ok: false,
      reason: `File contains ${tests.length} tests. Pass --test <name>. Found: ${tests.map((t) => JSON.stringify(t.name)).join(", ")}`,
    };
  }
  const exact = tests.filter((t) => t.name === testName);
  if (exact.length === 1) return { ok: true, test: exact[0] };
  const partial = tests.filter((t) => t.name.includes(testName));
  if (partial.length === 1) return { ok: true, test: partial[0] };
  if (partial.length === 0) {
    return {
      ok: false,
      reason: `No test matching ${JSON.stringify(testName)}. Found: ${tests.map((t) => JSON.stringify(t.name)).join(", ")}`,
    };
  }
  return {
    ok: false,
    reason: `Ambiguous --test ${JSON.stringify(testName)} matched ${partial.length} tests: ${partial.map((t) => JSON.stringify(t.name)).join(", ")}`,
  };
}

function rejectIfUnsupported(body: ts.Block, source: string): string | undefined {
  let reason: string | undefined;
  const visit = (node: ts.Node) => {
    if (reason) return;
    if (CONTROL_FLOW_KINDS.has(node.kind)) {
      reason = `Test body contains ${ts.SyntaxKind[node.kind]}. v0.1 rejects control-flow tests rather than pretending they reduce safely.`;
      return;
    }
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === "test" &&
        expr.name.text === "step"
      ) {
        reason = "test.step() is not supported in v0.1. Flatten the test to straight-line actions.";
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  void source;
  return reason;
}

function classifyStatement(
  stmt: ts.Statement,
  index: number,
  source: string,
  sourceFile: ts.SourceFile,
): TestStatement {
  const start = stmt.getStart(sourceFile);
  const end = stmt.getEnd();
  const fullStart = stmt.getFullStart();
  const text = source.slice(start, end);
  const { defined, used } = defUse(stmt);
  const kind = statementKind(stmt);
  return {
    index,
    kind,
    text,
    start,
    end,
    fullStart,
    defined,
    used,
    summary: summarize(kind, text),
  };
}

function statementKind(stmt: ts.Statement): StatementKind {
  if (ts.isVariableStatement(stmt)) return "binding";
  if (
    ts.isExpressionStatement(stmt) ||
    ts.isEmptyStatement(stmt)
  ) {
    if (containsExpect(stmt)) return "assertion";
    if (containsAction(stmt)) return "action";
    return "keep";
  }
  if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) return "keep";
  return "complex";
}

function containsExpect(node: ts.Node): boolean {
  let hit = false;
  const visit = (n: ts.Node) => {
    if (hit) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "expect") {
      hit = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return hit;
}

function containsAction(node: ts.Node): boolean {
  let hit = false;
  const visit = (n: ts.Node) => {
    if (hit) return;
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      if (ACTION_METHODS.has(n.expression.name.text)) {
        hit = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return hit;
}

function defUse(root: ts.Node): { defined: string[]; used: string[] } {
  const defined: string[] = [];
  const used: string[] = [];

  const visit = (node: ts.Node, skipIdent = false) => {
    if (ts.isVariableDeclaration(node)) {
      collectBindingNames(node.name, defined);
      if (node.initializer) visit(node.initializer);
      return;
    }
    if (ts.isParameter(node)) {
      collectBindingNames(node.name, defined);
      return;
    }
    if (ts.isIdentifier(node) && !skipIdent) {
      const parent = node.parent;
      if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) return;
      if (parent && ts.isPropertyAssignment(parent) && parent.name === node) return;
      used.push(node.text);
      return;
    }
    ts.forEachChild(node, (c) => visit(c));
  };

  visit(root);
  return {
    defined: unique(defined),
    used: unique(used.filter((n) => !defined.includes(n))),
  };
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

function summarize(kind: StatementKind, text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= 96) return `${kind}: ${one}`;
  return `${kind}: ${one.slice(0, 93)}...`;
}

export function isActionMethod(name: string): boolean {
  return ACTION_METHODS.has(name);
}

export { ACTION_METHODS };
