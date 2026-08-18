# Competition research (August 2026)

Thesis under evaluation:

> existing Playwright test + failure fingerprint → automated minimal failure-preserving action subset

v0.1 is **not** "trace.zip → standalone HTML". That is a different product. This document asks only: does an active tool already ship this exact wedge with good UX?

**Verdict: no. Do not KILL on competition grounds.**

## Playwright first-party tooling

### Trace Viewer

[Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) is a post-run inspector: action timeline, DOM snapshots, network, console, source mapping. It answers "what happened in this run?"

It does **not**:

- parse a `.spec.ts` into removable actions
- generate candidate tests
- run those candidates against a fingerprint
- emit a smaller Playwright test

A trace is evidence, not a replayable program. Official docs treat traces as a debugging artifact (`npx playwright show-trace trace.zip`), not as an input language for reduction.

### Codegen / Inspector / UI Mode

[`npx playwright codegen`](https://playwright.dev/docs/codegen), the Inspector, and VS Code "Record at cursor" **generate** actions while a human drives the browser. They make tests larger, or help write the first draft. They do not minimize an existing failing test to the subset that preserves one failure.

### Debug / "Copy prompt" (2025–2026)

Playwright's recent AI-assist debug flow copies a prompt with error, locator, and trace context into Copilot/ChatGPT. That is root-cause assistance. It does not systematically search the action lattice or guarantee the same fingerprint.

### CLI

`playwright test --last-failed`, sharding, `--grep`, traces-on-retry, and HTML report are execution/debug features. None implement delta debugging over test bodies.

## Adjacent OSS (2025–2026)

| Project | What it actually does | Same wedge? |
| --- | --- | --- |
| [BrowserTrace](https://github.com/aaronlab/browsertrace) | Local replay debugger for **Browser Use / Stagehand / Skyvern / Playwright+LLM agent** steps (screenshot, model I/O, first red step, public HTML export). | No. Records agent traces; does not reduce Playwright specs. |
| [playwright-trace-analyzer](https://pypi.org/project/playwright-trace-analyzer/) (Feb 2026) | CLI to dump actions/console/network from `trace.zip` without the GUI. | No. Read-only trace decode. |
| [playwright-trace-decoder-mcp](https://mcpservers.org/servers/vola-trebla/playwright-trace-decoder-mcp) | MCP tools to unpack `trace.zip` for agents. | No. And MCP is an explicit v0.1 non-goal. |
| Currents / TestDino / similar dashboards | CI observability, flake quarantine, orchestration. | No. They observe suites; they do not rewrite a spec. |
| Playwright "Copy prompt" / Copilot debug | LLM-assisted explanation of one failure. | No. Not a reducer, not fingerprint-stable. |

## Generic test-case reducers

These are real, mature, and **wrong-shaped** for this wedge:

| Tool | Granularity | Why it is not ReproMin |
| --- | --- | --- |
| [Lithium](https://github.com/MozillaSecurity/lithium) | Lines / characters | No Playwright action semantics, no failure fingerprint, no `page` fixture awareness. |
| Picire | Parallel ddmin on bytes/tokens | Same. |
| Perses / HDD | Grammar-based tree reduction | Could theoretically eat a `.ts` file; would spend most of its budget on syntactically legal but semantically `UNRESOLVED` subsets (missing `goto`, broken locators). No fingerprint object. |
| C-Reduce | C/C++ (and C-like) | Not a Playwright workflow. |
| Debugging Book / Fuzzing Book `ddmin` | Teaching implementations | Algorithms, not a Playwright CLI. |
| Generic "test-case-reducer" agent skills | Wrap ddmin around "run the test" | No AST action classification, no Playwright-specific UNRESOLVED, no fingerprint normalization. |

A skilled person *could* point Lithium at a spec and an interestingness script. That is not "an active project with good UX that already does exactly this." It also routinely deletes the `const promo = 'SAVE20'` that a later `fill` needs, or the `goto` that every later action depends on, and then treats the resulting timeout as "still failing."

That last failure mode is exactly why ReproMin exists: **same failure**, not **any failure**.

## What would have been a KILL

An active, documented tool that:

1. takes an existing Playwright TypeScript test
2. takes a failure fingerprint (or `--error-regex`)
3. deletes action-level statements with ddmin/HDD
4. writes back a smaller runnable spec
5. reports before/after action counts and N/N confirmation

No such project was found in Playwright docs, awesome-playwright, GitHub keyword search, PyPI, or 2025–2026 debugging write-ups.

## Differentiation (one paragraph)

Playwright tells you what the browser did. Codegen helps you record more of it. Traces and BrowserTrace help you stare at a recording. Generic reducers shrink files. **Nobody takes a bloated failing Playwright test and returns the smallest action list that still produces that specific failure.** That is the v0.1 wedge.
