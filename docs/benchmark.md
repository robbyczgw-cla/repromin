# ReproMin v0.1 benchmark

Measured 2026-08-17 on the development host: Linux, Node 22, Playwright Chromium headless, fixture shop on `127.0.0.1:7878`.

Each row is one `repromin` invocation against a local deterministic spec. Times include Playwright process startup for every uncached candidate.

| Fixture | Orig actions | Orig lines | Reduced actions | Reduced lines | Ratio | Runs | Time | Same FP | Confirm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| A noise prefix | 30 | 47 | 3 | 18 | 90% | 25 | 104s | YES | 1/1 |
| B joint flags | 12 | 29 | 5 | 20 | 58% | 39 | 134s | YES | 1/1 |
| C variable | 6 | 24 | 3 | 23 | 50% | 15 | 52s | YES | 1/1 |
| D unreachable | 7 | 19 | 4 | 18 | 43% | 23 | 93s | YES | 1/1 |
| E two failures | 12 | 24 | 8 | 23 | 33% | 90 | 474s | YES | 1/1 |
| F flaky survey | 7 | 24 | 3 | 23 | 57% | 31 | 123s | YES | 5/5 |
| killer demo | 70 | 151 | 9 | 31 | 87% | 202 | 744s | YES | 10/10 |

Reduced line counts for A–F are from the statement-deletion rewriter (comments left behind). The killer after-count is the reconstructed body (`demo/killer.min.spec.ts`).

## How to read this

- **Ratio** is `1 - reducedActions / originalActions`.
- **Same FP** means the minimized test still produces the original received failure (`PAYMENT_GATEWAY_CRASH` or `SECRET_PANEL_BUG`), not merely “some error”.
- Fixture B kept both `#enable-experimental` and `#unlock-promo`.
- Fixture C kept `const promoCode = "SAVE20"`.
- Fixture D kept `#reveal-secret` and `#confirm-reveal`; subsets that skip them are `UNRESOLVED` (timeout / empty panel), not interesting.
- Fixture E dropped the gadget detour and did **not** switch to `CART_EMPTY`.
- Fixture F dropped `#open-survey` and then held 5/5.
- Killer: 70 → 9, same NaN crash, 10/10.

## Performance note

A 70-action spec with sparse required navigation is the expensive case: most random subsets are `UNRESOLVED` timeouts. Prefix-chop + aligned chunk deletion + ddmin brought it to 9 actions in ~12 minutes. 30-action prefix-noise tests finish in about two minutes. That is usable for v0.1, not yet snappy.

Regenerate:

```bash
npm run benchmark
```
