import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coarseChunks, ddmin, prefixChop } from "../../src/ddmin.ts";

describe("ddmin", () => {
  it("keeps only the required tail", async () => {
    const units = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const needed = new Set([7, 8, 9]);
    const result = await ddmin(units, {
      pred: (subset) => (needed.size && [...needed].every((n) => subset.includes(n)) ? "INTERESTING" : "NOT_INTERESTING"),
    });
    assert.deepEqual(result, [7, 8, 9]);
  });

  it("treats UNRESOLVED as not reducing", async () => {
    const units = ["goto", "noise", "click", "assert"];
    const result = await ddmin(units, {
      pred: (subset) => {
        if (!subset.includes("goto")) return "UNRESOLVED";
        if (subset.includes("click") && subset.includes("assert")) return "INTERESTING";
        return "NOT_INTERESTING";
      },
    });
    assert.ok(result.includes("goto"));
    assert.ok(result.includes("click"));
    assert.ok(result.includes("assert"));
    assert.ok(!result.includes("noise"));
  });

  it("drops a parasitic adjacent pair", async () => {
    const units = ["goto", "open-other", "back", "add", "assert"];
    const result = await ddmin(units, {
      pred: (subset) => {
        if (!subset.includes("goto")) return "UNRESOLVED";
        if (subset.includes("open-other") && !subset.includes("back")) return "UNRESOLVED";
        if (subset.includes("back") && !subset.includes("open-other")) return "UNRESOLVED";
        if (subset.includes("add") && subset.includes("assert")) return "INTERESTING";
        return "NOT_INTERESTING";
      },
    });
    assert.deepEqual(result, ["goto", "add", "assert"]);
  });

  it("prefixChop keeps the first unit and drops a noise prefix", async () => {
    const units = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = await prefixChop(units, {
      pred: (subset) =>
        subset[0] === 0 && subset.includes(8) && subset.includes(9) ? "INTERESTING" : "NOT_INTERESTING",
    });
    assert.ok(result[0] === 0);
    assert.ok(result.includes(8) && result.includes(9));
    assert.ok(result.length < units.length);
  });

  it("coarseChunks drops aligned noise blocks", async () => {
    const units = [0, 1, 2, 3, 4, 5, 6, 7];
    const needed = new Set([0, 6, 7]);
    const result = await coarseChunks(units, {
      pred: (subset) => ([...needed].every((n) => subset.includes(n)) ? "INTERESTING" : "NOT_INTERESTING"),
    });
    assert.ok(result.length <= 4);
    assert.ok(needed.size && [...needed].every((n) => result.includes(n)));
  });

  it("handles joint dependencies", async () => {
    const units = ["a", "b", "c", "d"];
    const result = await ddmin(units, {
      pred: (subset) => (subset.includes("a") && subset.includes("c") ? "INTERESTING" : "NOT_INTERESTING"),
    });
    assert.deepEqual(result.sort(), ["a", "c"]);
  });
});
