# Limitations (v0.1)

ReproMin is intentionally narrow. If a test is outside this shape, it should **reject with a reason**, not silently emit a wrong subset.

## Supported tests

- TypeScript Playwright specs (`test('name', async ({ page }) => { ... })`)
- Straight-line bodies: `goto`, `click`, `fill`, `press`, `check`, `uncheck`, `selectOption`, `waitFor*`, `expect(...)`
- `test.describe` + `test.beforeEach` / `afterEach` are **kept as-is**
- `const` / `let` bindings are kept when a remaining statement uses them

## Rejected (clear error)

- `if` / `for` / `while` / `try` / `switch` in the **selected test body**
- `test.step(...)`
- concise arrow bodies without a block
- files with no `test()` calls
- tests with no removable action/assertion statements
- non-string test titles (template strings with substitutions)

## Not reduced, but kept

Unknown helper calls (`await login(page)`) are classified `keep`. They stay in every candidate. That is conservative and can hide reduction, which is preferable to deleting a custom fixture and calling the resulting timeout a "repro."

Page-object methods are the same: v0.1 will not open a class and reduce inside it.

## Dependencies are shallow

There is no full static analysis, no taint, no DOM model.

- Setup hooks are preserved, not reduced.
- Def/use is identifier-level only.
- If action 3 is required because it clicks "Enable checkout" and action 12 needs that flag, ReproMin discovers that **only by running the browser** (the subset without 3 is `NOT_INTERESTING` or `UNRESOLVED`).
- Joint dependencies (fixture B) work because ddmin will not accept a subset missing either flag.

## Failure identity can still be fooled

- Two different bugs that produce the **same Received string** look identical.
- A flake that sometimes emits the target string can be marked interesting during search. Use `--confirm N` on the final test (and `--search-confirm` if search itself is noisy).
- Timeouts that happen to mention the same locator as the original timeout will match more loosely than assertion failures.

## Performance

Each candidate is a cold `npx playwright test` in a temp file. Cost is roughly:

```
runs ≈ O(n) to O(n log n) browser launches
wall  ≈ runs × (startup + first failing action)
```

Mitigations in v0.1: execution cache, static UNRESOLVED for broken def/use, short `actionTimeout` in the fixture config, `--max-runs`.

A 30-action prefix-noise test finishes in about two minutes. The 70-action killer demo (needed clicks sprinkled through a codegen wander) took **202 runs / 12 minutes** on Chromium headless to reach the 1-minimal 9-action path. Hundreds of actions with 30s timeouts will feel impractical — that is a documented kill criterion, not an accident.

v0.1 spent that budget honestly: most random subsets are `UNRESOLVED` timeouts because they drop `goto` or a navigation that a later click needs. Prefix-chop + aligned chunk deletion + ddmin is what made 70 → 9 finish at all.

## Traces

`--` traces may be turned on in *your* Playwright config for evidence. ReproMin does not parse `trace.zip`, does not replay traces, and does not emit standalone HTML. The source spec is the artifact.

## Non-goals (still)

DOM/CSS/HAR reduction, selector healing, AI root-cause, dashboards, cloud, MCP, visual regression, synthesizing a page that reproduces the bug without the app.
