import { test, expect } from "@playwright/test";

/**
 * Killer demo: minimized by ReproMin.
 *
 * Original: 151 lines / 70 actions
 * Minimized: 9 actions that still produce
 *   Received: "PAYMENT_GATEWAY_CRASH: order total is NaN"
 * Confirmed 10/10.
 */
test.describe("killer demo", () => {
  test("checkout crashes", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
