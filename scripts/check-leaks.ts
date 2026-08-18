/**
 * Fail if the tree looks like it would leak secrets in a public clone.
 * Does not contact the network. Scan is text-only.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "test-results",
  "playwright-report",
  "blob-report",
  ".repromin-cache",
  "repromin-out",
]);

const SECRET_FILES = [
  /^\.env$/,
  /^\.env\..+$/,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /id_rsa/,
  /id_ed25519/,
  /\.npmrc$/,
  /credentials\.json$/i,
  /service-account.*\.json$/i,
];

const ALLOW_FILES = new Set([".env.example"]);

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub PAT", re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "GitHub fine-grained PAT", re: /github_pat_[A-Za-z0-9_]{20,}/ },
  { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Google API key", re: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: "private key block", re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ },
  { name: "generic password assignment", re: /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i },
];

const hits: string[] = [];
const SKIP_FILES = new Set(["scripts/check-leaks.ts"]);

async function walk(dir: string): Promise<void> {
  for (const name of await readdir(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      await walk(full);
      continue;
    }
    const rel = relative(root, full).replace(/\\/g, "/");
    if (SKIP_FILES.has(rel)) continue;
    if (!ALLOW_FILES.has(name) && SECRET_FILES.some((re) => re.test(name))) {
      hits.push(`${rel}: secret-looking filename`);
    }
    if (!/\.(ts|js|mjs|cjs|json|md|yml|yaml|env|sh|txt|html)$/i.test(name)) continue;
    const text = await readFile(full, "utf8");
    for (const p of PATTERNS) {
      if (p.re.test(text)) hits.push(`${rel}: ${p.name}`);
    }
  }
}

async function main() {
  await walk(root);
  if (hits.length) {
    process.stderr.write("Possible secret leak(s):\n" + hits.map((h) => `  - ${h}`).join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write("leak check: no obvious secrets in the working tree\n");
}

main();
