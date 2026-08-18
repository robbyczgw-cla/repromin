import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCliEntry } from "../../src/cli.ts";

describe("isCliEntry", () => {
  const modulePath = "/tmp/repromin/dist/cli.js";

  it("accepts a direct cli.js or cli.ts path", () => {
    assert.equal(isCliEntry("/tmp/repromin/dist/cli.js", modulePath), true);
    assert.equal(isCliEntry("/tmp/repromin/src/cli.ts", modulePath), true);
  });

  it("accepts the npm bin name without a .js suffix", () => {
    assert.equal(isCliEntry("/usr/local/bin/repromin", modulePath), true);
    assert.equal(isCliEntry("/tmp/app/node_modules/.bin/repromin", modulePath), true);
  });

  it("rejects an import from another file", () => {
    assert.equal(isCliEntry("/tmp/app/tests/unit/cli-entry.test.ts", modulePath), false);
    assert.equal(isCliEntry(undefined, modulePath), false);
  });
});
