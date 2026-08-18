import { test, expect } from "@playwright/test";

/**
 * Replay the paths ReproMin is supposed to keep or reject.
 * These are passing tests: they assert the app state that the reducer uses
 * as a fingerprint, not the original failing expect(ORDER_PLACED).
 */
test.describe("live repros of reduced paths", () => {
  test("killer 9-action path still produces the crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText(
      "PAYMENT_GATEWAY_CRASH: order total is NaN",
    );
  });

  test("A-min path: already on checkout, only promo + place", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText(
      "PAYMENT_GATEWAY_CRASH: order total is NaN",
    );
  });

  test("dropping add-to-cart switches the failure to CART_EMPTY", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("CART_EMPTY");
    await expect(page.locator("#checkout-modal-text")).not.toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("C-min path keeps a variable fill of SAVE20", async ({ page }) => {
    const promoCode = "SAVE20";
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill(promoCode);
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("page.click style locators still hit the crash", async ({ page }) => {
    await page.goto("/");
    await page.click("#accept-cookies");
    await page.click("#nav-shop");
    await page.click("#open-crash-widget");
    await page.click("#add-to-cart");
    await page.click("#nav-cart");
    await page.click("#cart-checkout");
    await page.fill("#promo", "SAVE20");
    await page.click("#place-order");
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });
});
