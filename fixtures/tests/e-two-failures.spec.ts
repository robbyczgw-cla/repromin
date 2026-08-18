import { test, expect } from "@playwright/test";

test.describe("fixture E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
  });

  test("same test two failure modes", async ({ page }) => {
    await page.locator("#nav-shop").click();
    await page.locator("#open-gadget-c").click();
    await page.locator("#add-to-wishlist").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#email").fill("two@example.com");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
