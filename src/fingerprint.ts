import type { FailureFingerprint } from "./types.js";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const PATH_RE = /(?:[A-Za-z]:)?(?:\/|\\)(?:[^\s:'"]+\/)+[^\s:'"]+/g;
const PORT_RE = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/g;
const MS_RE = /\b\d+(?:\.\d+)?\s*m?s\b/gi;
const RUN_ID_RE = /\b(?:run|test|worker|shard)[-_ ]?(?:id|index)?[=:# ]+[A-Za-z0-9._-]+/gi;
const HEX_RE = /\b[0-9a-f]{16,}\b/gi;
const LINECOL_RE = /:(\d+):(\d+)\b/g;
const PID_RE = /\bpid[=: ]+\d+/gi;

export function isUnusableFailure(message: string): boolean {
  return /no tests found/i.test(message) || /test was skipped/i.test(message);
}

export function normalizeFailureText(text: string): string {
  let out = text.replace(/\r\n/g, "\n");
  out = out.replace(UUID_RE, "<uuid>");
  out = out.replace(ISO_DATE_RE, "<date>");
  out = out.replace(PATH_RE, "<path>");
  out = out.replace(/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d{2,5}/g, "$1:<port>");
  out = out.replace(MS_RE, "<time>");
  out = out.replace(RUN_ID_RE, "<run>");
  out = out.replace(HEX_RE, "<hex>");
  out = out.replace(LINECOL_RE, ":<line>:<col>");
  out = out.replace(PID_RE, "pid=<pid>");
  out = out.replace(/\b\d{4,}\b/g, "<n>");
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

export function extractMatcher(message: string): string | undefined {
  const m = message.match(/expect\(locator\)\.(\w+)/i) ?? message.match(/expect\([^)]*\)\.(\w+)/i);
  return m?.[1];
}

export function extractExpected(message: string): string | undefined {
  const m =
    message.match(/Expected(?: string| substring)?:\s*"([^"]+)"/i) ??
    message.match(/Expected(?: string| substring)?:\s*(.+)/i);
  return m?.[1]?.trim();
}

export function extractReceived(message: string): string | undefined {
  const m =
    message.match(/Received(?: string| substring)?:\s*"([^"]+)"/i) ??
    message.match(/Received(?: string| substring)?:\s*(.+)/i);
  return m?.[1]?.trim();
}

export function extractLocatorHint(message: string): string | undefined {
  const locator = message.match(/Locator:\s*(.+)/i);
  if (locator) return locator[1].trim();
  const waiting = message.match(/waiting for locator\((['"`])(.+?)\1\)/i);
  if (waiting) return waiting[2];
  const css = message.match(/locator\((['"`])(.+?)\1\)/);
  if (css) return css[2];
  return undefined;
}

export function extractErrorName(message: string, stack?: string): string {
  const head = (stack ?? message).split("\n")[0] ?? "";
  const named = head.match(/^([A-Za-z][A-Za-z0-9.]*)(?:Error|Exception)\b/)
    ?? message.match(/\b(TimeoutError|Error|AssertionError|TypeError|ReferenceError)\b/);
  if (named) {
    if (named[0].endsWith("Error") || named[0].endsWith("Exception")) return named[0];
    return named[1] ?? named[0];
  }
  if (/Timeout/i.test(message)) return "TimeoutError";
  if (/expect\(/i.test(message)) return "Error";
  return "Error";
}

export function extractStackLocation(stack?: string): string | undefined {
  if (!stack) return undefined;
  const line = stack.split("\n").find((l) => /:\d+:\d+/.test(l) && !/node_modules/.test(l));
  if (!line) return undefined;
  return normalizeFailureText(line.trim());
}

export function buildFingerprint(args: {
  message: string;
  stack?: string;
  userRegex?: string;
}): FailureFingerprint {
  const message = args.message.trim();
  return {
    errorName: extractErrorName(message, args.stack),
    message,
    normalizedMessage: normalizeFailureText(message),
    matcher: extractMatcher(message),
    locatorHint: extractLocatorHint(message),
    stackLocation: extractStackLocation(args.stack),
    userRegex: args.userRegex,
  };
}

export function receivedOf(fp: FailureFingerprint): string | undefined {
  return extractReceived(fp.message);
}

function coreTokens(fp: FailureFingerprint): string[] {
  const parts = [
    fp.matcher,
    fp.locatorHint,
    ...fp.normalizedMessage
      .split(/\s+/)
      .filter((t) => t.length > 3 && !["Error", "expect", "Locator", "Received", "Expected", "Call"].includes(t)),
  ].filter((x): x is string => Boolean(x));
  return parts.slice(0, 24);
}

/**
 * Same-failure check. Never treat "it failed somehow" as a match.
 * User regex is authoritative when provided; otherwise require the
 * normalized message to share the distinctive failure tokens.
 */
export function fingerprintsMatch(expected: FailureFingerprint, actual: FailureFingerprint): boolean {
  if (isUnusableFailure(expected.message) || isUnusableFailure(actual.message)) return false;
  if (expected.userRegex) {
    try {
      const re = new RegExp(expected.userRegex);
      return re.test(actual.message) || re.test(actual.normalizedMessage);
    } catch {
      return false;
    }
  }

  if (expected.errorName && actual.errorName && expected.errorName !== actual.errorName) {
    // Assertion failures sometimes surface as Error vs AssertionError.
    const soft = new Set(["Error", "AssertionError"]);
    if (!(soft.has(expected.errorName) && soft.has(actual.errorName))) {
      return false;
    }
  }

  if (expected.matcher && actual.matcher && expected.matcher !== actual.matcher) {
    return false;
  }

  const expectedReceived = extractReceived(expected.message);
  const actualReceived = extractReceived(actual.message);
  if (expectedReceived && actualReceived) {
    return normalizeFailureText(expectedReceived) === normalizeFailureText(actualReceived);
  }
  if (expectedReceived && !actualReceived) return false;

  const expectedCore = expected.normalizedMessage;
  const actualCore = actual.normalizedMessage;
  if (expectedCore === actualCore) return true;

  // Require a distinctive substring from the original failure.
  const distinctive = pickDistinctiveSnippet(expected);
  if (distinctive && actualCore.includes(distinctive)) return true;
  if (distinctive && actual.message.includes(distinctive)) return true;

  const tokens = coreTokens(expected).filter((t) => t.length >= 6);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((t) => actualCore.includes(t) || actual.message.includes(t));
  return hit.length >= Math.min(3, tokens.length);
}

function pickDistinctiveSnippet(fp: FailureFingerprint): string | undefined {
  const received = extractReceived(fp.message);
  if (received) {
    const banner = received.match(/\b([A-Z][A-Z0-9]{3,}(?:_[A-Z0-9: -]+)+)\b/);
    if (banner) return banner[1];
    if (received.length >= 8) return received.slice(0, 80);
  }
  const quoted = fp.message.match(/['"]([A-Z][A-Z0-9_:-]{5,})['"]/);
  if (quoted) return quoted[1];
  const banner = fp.message.match(/\b([A-Z][A-Z0-9]{3,}(?:_[A-Z0-9]+){1,})\b/);
  if (banner) return banner[1];
  return undefined;
}

export function describeFingerprint(fp: FailureFingerprint): string {
  const distinctive = pickDistinctiveSnippet(fp);
  if (distinctive) return `${fp.errorName}: ${distinctive}`;
  const first = fp.normalizedMessage.split("\n")[0] ?? fp.normalizedMessage;
  return first.slice(0, 120);
}
