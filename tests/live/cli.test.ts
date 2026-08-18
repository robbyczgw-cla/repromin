import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

describe("live CLI", () => {
  it("dry-run lists removable actions on the killer spec", () => {
    const result = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "fixtures/tests/killer.spec.ts", "--test", "checkout crashes", "--dry-run"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Removable: 7\d/);
    assert.match(result.stdout, /goto/);
    assert.match(result.stdout, /open-crash-widget/);
    assert.match(result.stdout, /place-order/);
  });

  it("rejects a missing spec with a non-zero exit", () => {
    const result = spawnSync("npx", ["tsx", "src/cli.ts", "fixtures/tests/nope.spec.ts", "--dry-run"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not found/i);
  });
});
