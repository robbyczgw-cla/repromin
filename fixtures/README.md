# FixtureMart

This is **not** a real store and not connected to the internet.

It is a tiny local demo shop (`fixtures/apps/`) that ReproMin uses as a deterministic lab. One Node server serves a single-page app on `http://127.0.0.1:7878`. No accounts, no payments, no third-party APIs.

The catalog is fake: Widget A/B, Gadget C/D, Spare E, and **Crash Widget**. Checkout is scripted so we can reproduce one known bug:

> `crash-widget` in the cart + promo `SAVE20` → `PAYMENT_GATEWAY_CRASH: order total is NaN`

Everything else (cookies, newsletter, blog, account, filters) is noise so the reducer has something to delete.

```bash
npx tsx fixtures/apps/server.ts
npx playwright test --config tests/live/playwright.config.ts
```
