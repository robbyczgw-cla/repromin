import { test, expect } from "@playwright/test";

test.describe("fixture A", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
  });

  test("checkout crashes after noisy form filling", async ({ page }) => {
    await page.locator("#email").fill("noise0@example.com");
    await page.locator("#full-name").fill("Noise Person");
    await page.locator("#address1").fill("1 Noise Street");
    await page.locator("#address2").fill("Suite 2");
    await page.locator("#city").fill("Noisechester");
    await page.locator("#zip").fill("00001");
    await page.locator("#country").selectOption("DE");
    await page.locator("#card-number").fill("4242424242424242");
    await page.locator("#card-exp").fill("12/30");
    await page.locator("#card-cvc").fill("123");
    await page.locator("#email").fill("noise1@example.com");
    await page.locator("#full-name").fill("Noise Person II");
    await page.locator("#address1").fill("2 Noise Street");
    await page.locator("#address2").fill("Floor 3");
    await page.locator("#city").fill("Noisetown");
    await page.locator("#zip").fill("00002");
    await page.locator("#country").selectOption("GB");
    await page.locator("#card-number").fill("4000056655665556");
    await page.locator("#card-exp").fill("01/29");
    await page.locator("#card-cvc").fill("999");
    await page.locator("#email").fill("noise2@example.com");
    await page.locator("#full-name").fill("Noise Person III");
    await page.locator("#address1").fill("3 Noise Street");
    await page.locator("#city").fill("Noiseville");
    await page.locator("#zip").fill("00003");
    await page.locator("#country").selectOption("US");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });
});
