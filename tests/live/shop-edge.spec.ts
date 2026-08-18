import { test, expect } from "@playwright/test";

test.describe("live shop — edge cases", () => {
  test("empty search still lists the catalog", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#search").fill("crash");
    await page.locator("#search").press("Enter");
    await page.locator("#search").fill("");
    await page.locator("#search-btn").click();
    await expect(page.locator("#open-widget-a")).toBeVisible();
    await expect(page.locator("#open-gadget-c")).toBeVisible();
  });

  test("search with no hits empties the grid", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#search").fill("zzzz-no-such-sku");
    await page.locator("#search-btn").click();
    await expect(page.locator(".open-product")).toHaveCount(0);
  });

  test("qty 0 is treated as 1", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#product-qty").fill("0");
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await expect(page.locator("#cart-count")).toHaveText("1");
  });

  test("wrong promo SAVE10 does not crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE10");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("clearing SAVE20 then placing does not crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await page.locator("#promo").fill("");
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_CLEARED");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("mixed cart still crashes if crash-widget remains", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await expect(page.locator("#cart-count")).toHaveText("2");
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("removing crash-widget from a mixed cart restores a good order", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator(".remove-item").last().click();
    await expect(page.locator("#cart-items")).toContainText("widget-a");
    await expect(page.locator("#cart-items")).not.toContainText("crash-widget");
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("reload drops in-memory cart", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.reload();
    await expect(page.locator("#cart-count")).toHaveText("0");
  });

  test("hash #cart and #checkout open those views", async ({ page }) => {
    await page.goto("/#cart");
    await page.locator("#accept-cookies").click();
    await expect(page.locator("#view-cart")).toBeVisible();
    await page.goto("/#checkout");
    await expect(page.locator("#view-checkout")).toBeVisible();
  });

  test("place-order twice still shows the crash", async ({ page }) => {
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
    await page.locator("#close-modal").click();
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });

  test("only experimental flag is not enough under gate=1", async ({ page }) => {
    await page.goto("/?gate=1");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#enable-experimental").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_LOCKED");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");
  });

  test("backordered gadget-d can still be added", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-gadget-d").click();
    await page.locator("#add-to-cart").click();
    await expect(page.locator("#product-status")).toHaveText("ADDED:gadget-d");
  });

  test("checkout works even if the cookie banner is still up", async ({ page }) => {
    await page.goto("/");
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });
});
