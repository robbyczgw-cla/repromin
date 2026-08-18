import { test, expect } from "@playwright/test";

/** Small failing spec for the live suite: cheap to reduce, still real Chromium. */
test.describe("fixture G", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
  });

  test("compact checkout crash", async ({ page }) => {
    await page.locator("#email").fill("compact@example.com");
    await page.locator("#full-name").fill("Compact User");
    await page.locator("#country").selectOption("DE");
    await page.locator("#card-cvc").fill("111");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
