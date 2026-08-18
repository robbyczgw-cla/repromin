# ReproMin

Turn a long, failing Playwright test into the shortest one that still fails **the same way**.

```
BEFORE                 AFTER
151 lines              31 lines
70 actions             9 actions

Same failure: YES
Confirmed:    10/10
```

You had a codegen or copy-paste spec with dozens of clicks. The real bug only needs a handful. ReproMin deletes the rest and checks every candidate in a real browser so it does not swap in a different error.

Experimental **v0.1** — a local CLI, not a cloud product. MIT license.

## Quick start

Needs Node 20+ and Chromium.

```bash
git clone https://github.com/robbyczgw-cla/repromin.git
cd repromin
npm install
npx playwright install chromium
```

Dry-run (no browser) to see what it would try to delete:

```bash
npx tsx src/cli.ts fixtures/tests/killer.spec.ts --test "checkout crashes" --dry-run
```

Shrink the included demo test (this launches Chromium, a few minutes):

```bash
npm run demo
```

On your own failing spec:

```bash
npx tsx src/cli.ts path/to/checkout.spec.ts \
  --test "checkout crashes" \
  --error-regex "PAYMENT_GATEWAY_CRASH" \
  --confirm 10
```

After `npm run build` you can also run `node dist/cli.js …`.

## What you get

A smaller `.spec.ts` next to a report:

```
ReproMin v0.1

BEFORE
151 lines
70 actions

AFTER
31 lines
9 actions

Same failure fingerprint: YES
Confirmed: 10/10
```

ReproMin only counts a candidate as a win if it reproduces the **same** failure (the received assertion text, or your `--error-regex`). A timeout on the wrong locator, or a different message like `CART_EMPTY`, is not a repro.

| Flag | What it does |
| --- | --- |
| `--test <name>` | Which test in the file (required if there are several) |
| `--error-regex <re>` | Pin the failure message |
| `--confirm <n>` | Re-run the minimized test N times |
| `--timeout <ms>` | Per-candidate timeout (default 15000) |
| `--config <file>` | Playwright config (auto-discovered) |
| `--out <dir>` | Where to write the minimized spec |
| `--dry-run` | List removable actions only |
| `--verbose` | Print each candidate |
| `--max-runs <n>` | Safety cap (default 200) |

## What it supports

Straight-line TypeScript Playwright tests:

```ts
test('checkout crashes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav-shop').click();
  await page.locator('#promo').fill('SAVE20');
  await page.locator('#place-order').click();
  await expect(page.locator('#modal')).toHaveText('ORDER_PLACED');
});
```

`beforeEach` / `describe` stay as-is. Variables stay if a kept line uses them.

It **rejects** (with a reason) tests that use `if` / `for` / `try` / `test.step`. Unknown helpers such as `await login(page)` are kept, not deleted.

It does **not** shrink the DOM, CSS, HAR, or emit a standalone HTML page. Playwright Trace Viewer still explains a run; codegen still records one. ReproMin shrinks an existing spec. Details: [docs/limitations.md](docs/limitations.md), [docs/competition.md](docs/competition.md).

## Try it on the included shop

`fixtures/` is **FixtureMart**, a tiny fake store that runs only on your machine (`http://127.0.0.1:7878`). No internet, no payments, no accounts.

The planted bug: add **Crash Widget**, apply promo `SAVE20`, place the order → `PAYMENT_GATEWAY_CRASH: order total is NaN`.

| Demo | What it shows |
| --- | --- |
| A | 30 noisy fills; only the last few matter |
| B | Two earlier clicks are both required |
| C | A `const` used by a later `fill` is kept |
| D | Dropping setup makes the test unreachable, not “interesting” |
| E | Same test can fail two ways; the chosen crash is kept |
| F | A flaky extra click is dropped; `--confirm 5` holds |
| killer | 70 actions → 9, same crash, 10/10 |

Numbers: [docs/benchmark.md](docs/benchmark.md). Side by side: [demo/BEFORE-AFTER.md](demo/BEFORE-AFTER.md). Shop notes: [fixtures/README.md](fixtures/README.md).

## Tests

```bash
npm run test:unit          # fast, no browser
npm run test:live:pw       # 55 Chromium specs against FixtureMart
npm run test:live          # Playwright + compact real reduction
npm run check:leaks        # cheap scan before you push
```

`npm run test:integration` re-runs the full A–F and killer reductions. That takes many minutes.

## How it works

1. Parse the named `test()` with the TypeScript compiler API.
2. Treat each Playwright action / `expect` as a removable unit.
3. Run the original test and capture a [failure fingerprint](docs/failure-fingerprints.md).
4. Search smaller subsets (delta debugging). Each candidate is a real `playwright test` run.
5. Confirm the winner `--confirm` times and write the minimized spec.

A 30-action noisy test is usually a couple of minutes. A 70-action wander with clicks sprinkled through the file was about 12 minutes on this project’s machine.

## License and security

MIT. See [LICENSE](LICENSE) and [SECURITY.md](SECURITY.md).

Do not commit `.env`, traces from a logged-in session, or minimized specs that still contain customer data.
