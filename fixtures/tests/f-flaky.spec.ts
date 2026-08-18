import { test, expect } from "@playwright/test";

test.describe("fixture F", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
  });

  test("flaky survey action", async ({ page }) => {
    await page.locator("#nav-home").click();
    await page.locator("#open-survey").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
