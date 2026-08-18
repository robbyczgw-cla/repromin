import { test, expect } from "@playwright/test";

test.describe("fixture B", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?gate=1");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
  });

  test("joint flags required for crash", async ({ page }) => {
    await page.locator("#email").fill("joint@example.com");
    await page.locator("#full-name").fill("Joint State");
    await page.locator("#address1").fill("10 Dual Lane");
    await page.locator("#city").fill("Twoville");
    await page.locator("#zip").fill("22222");
    await page.locator("#card-number").fill("4242424242424242");
    await page.locator("#enable-experimental").click();
    await page.locator("#unlock-promo").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
