# Failure fingerprints

ReproMin refuses the default "the test failed somehow." A candidate is `INTERESTING` only when it reproduces the **same** failure as the original.

## What is captured

From the Playwright JSON report (plus the error object):

| Field | Source | Role |
| --- | --- | --- |
| `errorName` | `TimeoutError`, `Error`, `AssertionError`, … | Hard mismatch unless Error/AssertionError |
| `message` | raw Playwright error | Shown in the report |
| `normalizedMessage` | message with unstable tokens stripped | Equality fallback |
| `matcher` | `toHaveText`, `toContainText`, … | Must not silently change |
| `locatorHint` | `locator('#checkout-modal-text')` | Diagnostic |
| `received` | `Received string: "…"` | **Primary same-failure signal for assertions** |
| `--error-regex` | user | Authoritative when provided |

## Normalization

These are rewritten before comparison:

- ISO timestamps
- absolute paths (`/tmp/repromin-…`, Windows paths)
- `localhost:PORT` / `127.0.0.1:PORT`
- durations (`30000ms`)
- UUIDs and long hex
- `worker` / `run` / `pid` tokens
- `:line:column` in stacks

Line numbers **must not** be part of the identity: every candidate is a different file.

## Classification

```
same fingerprint          → INTERESTING
test passed               → NOT_INTERESTING
syntax / load error       → UNRESOLVED
missing names (def/use)   → UNRESOLVED (no browser run)
timeout on a different
  locator / no received   → UNRESOLVED
different Received text   → UNRESOLVED
```

Example — fixture E:

```
Original received:  PAYMENT_GATEWAY_CRASH: order total is NaN
Empty-cart received: CART_EMPTY
```

Same `expect(...).toHaveText('ORDER_PLACED')`, **different failure**. The empty-cart subset is not a repro.

## `--error-regex`

```
repromin checkout.spec.ts --test "checkout crashes" \
  --error-regex "PAYMENT_GATEWAY_CRASH"
```

When set, the original failure must match the regex (or ReproMin exits) and every interesting candidate must match it too. Use this when you already know the bug string and Playwright's wrapping text is noisy.

## What we do not fingerprint in v0.1

- screenshot / visual diffs
- network HAR
- console logs, unless you put them in `--error-regex` via a custom expect
- process exit code alone
- "any TimeoutError"

Those are useful later. They are too coarse to prove the thesis.
