import { test, expect } from "@playwright/test";

/**
 * Flows that look like a recorded codegen session: roles, placeholders,
 * a full checkout form, viewport change, back navigation, waitFor.
 */
test.describe("live shop — real-world Playwright style", () => {
  test("getByRole and getByPlaceholder can drive the crash path", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accept cookies" }).click();
    await page.getByRole("button", { name: /^Shop$/ }).click();
    await page.getByPlaceholder("Search products").fill("crash");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: "View" }).click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("button", { name: /Cart/ }).click();
    await page.getByRole("button", { name: "Checkout" }).click();
    await page.getByPlaceholder("Promo code").fill("SAVE20");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.locator("#checkout-modal-text")).toHaveText(
      "PAYMENT_GATEWAY_CRASH: order total is NaN",
    );
  });

  test("full billing form is ignored by the broken total", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#email").fill("casey@example.com");
    await page.locator("#full-name").fill("Casey Checkout");
    await page.locator("#address1").fill("100 Market Street");
    await page.locator("#address2").fill("Floor 4");
    await page.locator("#city").fill("Springfield");
    await page.locator("#zip").fill("62701");
    await page.locator("#country").selectOption("US");
    await page.locator("#card-number").fill("4242424242424242");
    await page.locator("#card-exp").fill("12/30");
    await page.locator("#card-cvc").fill("123");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("codegen-like wander then crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#promo-summer").click();
    await page.locator("#nav-help").click();
    await page.locator("#faq-shipping").click();
    await page.locator("#nav-blog").click();
    await page.locator("#read-post-1").click();
    await page.locator("#nav-account").click();
    await page.locator("#save-profile").click();
    await page.locator("#nav-shop").click();
    await page.locator("#sort").selectOption("price");
    await page.locator("#open-gadget-c").click();
    await page.locator("#add-to-wishlist").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("mobile viewport can still reproduce the crash", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("waitFor the grid then goBack from a product", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#product-grid").waitFor({ state: "visible" });
    await page.locator("#open-widget-a").click();
    await expect(page.locator("#product-name")).toHaveText("Widget A");
    await page.locator("#back-to-shop").click();
    await expect(page.locator("#view-shop")).toBeVisible();
    await page.locator("#open-crash-widget").click();
    await expect(page.locator("#product-name")).toHaveText("Crash Widget");
  });

  test("wrong promo then corrected SAVE20 crashes", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE10");
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_APPLIED:SAVE10");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("keyboard tab can focus checkout fields before the crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#email").click();
    await page.keyboard.type("tabuser@example.com");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Tab User");
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("double add-to-cart still crashes with SAVE20", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await expect(page.locator("#cart-count")).toHaveText("2");
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });
});
