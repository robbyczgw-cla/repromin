# Killer demo — before / after

Measured 2026-08-17 on this machine, Chromium headless.

```
BEFORE
151 lines
70 actions

AFTER
31 lines   (reconstructed body; 9 statements)
9 actions

Same failure fingerprint: YES
Confirmed: 10/10
Runs: 202
Time: 744.1s
```

Fingerprint:

```
Error: expect(locator).toHaveText(expected) failed
Locator:  locator('#checkout-modal-text')
Expected: "ORDER_PLACED"
Received: "PAYMENT_GATEWAY_CRASH: order total is NaN"
```

## After (the 9 statements ReproMin kept)

```ts
await page.goto("/");
await page.locator("#nav-shop").click();
await page.locator("#open-crash-widget").click();
await page.locator("#add-to-cart").click();
await page.locator("#nav-cart").click();
await page.locator("#cart-checkout").click();
await page.locator("#promo").fill("SAVE20");
await page.locator("#place-order").click();
await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
```

That is the 1-minimal path through this shop: land, open shop, open the bad SKU, add it, go to checkout, apply `SAVE20`, place the order. Everything else in the original 70-action codegen wander is noise.

The original file is `fixtures/tests/killer.spec.ts`.
The minimized file is `demo/killer.min.spec.ts`.

Re-run the reduction:

```bash
npx tsx src/cli.ts fixtures/tests/killer.spec.ts \
  --test "checkout crashes" \
  --confirm 10 \
  --error-regex "PAYMENT_GATEWAY_CRASH" \
  --config fixtures/playwright.config.ts
```
