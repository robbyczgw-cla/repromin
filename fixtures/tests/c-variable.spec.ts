import { test, expect } from "@playwright/test";

test.describe("fixture C", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
  });

  test("variable used by later fill", async ({ page }) => {
    await page.locator("#email").fill("var@example.com");
    await page.locator("#full-name").fill("Var User");
    const promoCode = "SAVE20";
    await page.locator("#city").fill("Varcity");
    await page.locator("#promo").fill(promoCode);
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
