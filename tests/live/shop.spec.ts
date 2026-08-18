import { test, expect } from "@playwright/test";

test.describe("live shop — passing Chromium paths", () => {
  test("home is ready and cookies can be accepted", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#app-ready")).toHaveText("ready");
    await page.locator("#accept-cookies").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();
  });

  test("happy path: widget-a checkout places an order", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await expect(page.locator("#product-status")).toContainText("ADDED:widget-a");
    await page.locator("#nav-cart").click();
    await expect(page.locator("#cart-status")).toHaveText("CART_HAS_ITEMS");
    await page.locator("#cart-checkout").click();
    await page.locator("#email").fill("ok@example.com");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("empty cart checkout shows CART_EMPTY", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("CART_EMPTY");
  });

  test("crash-widget + SAVE20 shows the payment NaN crash", async ({ page }) => {
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

  test("crash-widget without promo does not crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("search Enter, checkbox filter, and sort still list crash-widget", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#search").fill("crash");
    await page.locator("#search").press("Enter");
    await expect(page.locator("#open-crash-widget")).toBeVisible();
    await expect(page.locator("#open-gadget-c")).toHaveCount(0);
    await page.locator("#search").fill("");
    await page.locator("#search-btn").click();
    await page.locator("#filter-widgets").check();
    await page.locator("#sort").selectOption("name");
    await expect(page.locator("#open-crash-widget")).toBeVisible();
    await page.locator("#filter-widgets").uncheck();
  });

  test("gated checkout needs both flags to crash", async ({ page }) => {
    await page.goto("/?gate=1");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
    await page.locator("#close-modal").click();
    await page.locator("#enable-experimental").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
    await page.locator("#close-modal").click();
    await page.locator("#unlock-promo").click();
    await page.locator("#apply-promo").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText(
      "PAYMENT_GATEWAY_CRASH: order total is NaN",
    );
  });

  test("secret panel is empty until both reveal clicks", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#open-secret").click();
    await expect(page.locator("#secret-panel")).toBeHidden();
    await page.locator("#reveal-secret").click();
    await expect(page.locator("#secret-panel")).toBeHidden();
    await page.locator("#confirm-reveal").click();
    await expect(page.locator("#secret-panel")).toBeVisible();
    await expect(page.locator("#secret-panel")).toHaveText("SECRET_PANEL_BUG");
  });

  test("wishlist, compare, account, blog, and help are clickable", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#open-newsletter").click();
    await page.locator("#newsletter-email").fill("n@example.com");
    await page.locator("#newsletter-submit").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-gadget-c").click();
    await page.locator("#product-color").selectOption("blue");
    await page.locator("#add-to-wishlist").click();
    await page.locator("#add-to-compare").click();
    await page.locator("#nav-wishlist").click();
    await expect(page.locator("#wishlist-list")).toContainText("gadget-c");
    await page.locator("#nav-compare").click();
    await expect(page.locator("#compare-list")).toContainText("gadget-c");
    await page.locator("#nav-account").click();
    await page.locator("#save-profile").click();
    await expect(page.locator("#account-status")).toHaveText("PROFILE_SAVED");
    await page.locator("#nav-blog").click();
    await page.locator("#read-post-1").click();
    await expect(page.locator("#blog-status")).toHaveText("POST_1");
    await page.locator("#nav-help").click();
    await page.locator("#faq-shipping").click();
    await expect(page.locator("#help-status")).toHaveText("FAQ_SHIPPING");
  });
});
