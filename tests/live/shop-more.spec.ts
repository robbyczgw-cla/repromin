import { test, expect } from "@playwright/test";

test.describe("live shop — extra surfaces", () => {
  test("health endpoint is up", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBeTruthy();
    expect(await res.text()).toBe("ok");
  });

  test("reject cookies hides the banner", async ({ page }) => {
    await page.goto("/");
    await page.locator("#reject-cookies").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();
  });

  test("cookie settings marks the banner expanded", async ({ page }) => {
    await page.goto("/");
    await page.locator("#cookie-settings").click();
    await expect(page.locator("#cookie-banner")).toHaveAttribute("data-expanded", "1");
    await page.locator("#accept-cookies").click();
    await expect(page.locator("#cookie-banner")).toBeHidden();
  });

  test("home CTA and promo tiles change the landing copy", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#promo-summer").click();
    await expect(page.locator("#hero-copy")).toHaveText("Summer sale is on");
    await page.locator("#promo-clearance").click();
    await expect(page.locator("#hero-copy")).toHaveText("Clearance aisle");
    await page.locator("#promo-new").click();
    await expect(page.locator("#hero-copy")).toHaveText("New arrivals");
    await page.locator("#home-shop-cta").click();
    await expect(page.locator("#view-shop")).toBeVisible();
  });

  test("newsletter can be closed without subscribing", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#open-newsletter").click();
    await expect(page.locator("#newsletter-popup")).toBeVisible();
    await page.locator("#newsletter-close").click();
    await expect(page.locator("#newsletter-popup")).toBeHidden();
    await expect(page.locator("#newsletter-status")).toHaveText("");
  });

  test("hash #shop deep-links into the catalog", async ({ page }) => {
    await page.goto("/#shop");
    await page.locator("#accept-cookies").click();
    await expect(page.locator("#view-shop")).toBeVisible();
    await expect(page.locator("#open-widget-a")).toBeVisible();
  });

  test("currency switch shows on the next product view", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#currency").selectOption("EUR");
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-b").click();
    await expect(page.locator("#product-price")).toHaveText("29 EUR");
  });

  test("qty 2 adds two lines and cart count is 2", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-spare-e").click();
    await page.locator("#product-qty").fill("2");
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await expect(page.locator("#cart-count")).toHaveText("2");
    await expect(page.locator("#cart-items li")).toHaveCount(2);
  });

  test("remove item returns the cart to empty", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator(".remove-item").click();
    await expect(page.locator("#cart-status")).toHaveText("CART_EMPTY");
    await expect(page.locator("#cart-count")).toHaveText("0");
  });

  test("continue shopping returns to the shop grid", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#continue-shopping").click();
    await expect(page.locator("#view-shop")).toBeVisible();
  });

  test("in-stock filter hides backordered gadget-d", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await expect(page.locator("#open-gadget-d")).toBeVisible();
    await page.locator("#filter-in-stock").check();
    await expect(page.locator("#open-gadget-d")).toHaveCount(0);
    await expect(page.locator("#open-gadget-c")).toBeVisible();
    await page.locator("#clear-filters").click();
    await expect(page.locator("#open-gadget-d")).toBeVisible();
  });

  test("gadget filter hides widgets", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#filter-gadgets").check();
    await expect(page.locator("#open-gadget-c")).toBeVisible();
    await expect(page.locator("#open-widget-a")).toHaveCount(0);
    await expect(page.locator("#open-crash-widget")).toHaveCount(0);
  });

  test("apply promo without gate writes PROMO_APPLIED", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_APPLIED:SAVE20");
  });

  test("gated promo stays locked until unlock", async ({ page }) => {
    await page.goto("/?gate=1");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_LOCKED");
    await page.locator("#unlock-promo").click();
    await page.locator("#apply-promo").click();
    await expect(page.locator("#promo-status")).toHaveText("PROMO_APPLIED:SAVE20");
  });

  test("account addresses and payments, help returns and billing", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-account").click();
    await page.locator("#profile-name").fill("Casey");
    await page.locator("#profile-phone").fill("555-0100");
    await page.locator("#open-addresses").click();
    await expect(page.locator("#account-status")).toHaveText("ADDRESSES");
    await page.locator("#open-payments").click();
    await expect(page.locator("#account-status")).toHaveText("PAYMENTS");
    await page.locator("#nav-help").click();
    await page.locator("#faq-returns").click();
    await expect(page.locator("#help-status")).toHaveText("FAQ_RETURNS");
    await page.locator("#faq-billing").click();
    await expect(page.locator("#help-status")).toHaveText("FAQ_BILLING");
    await page.locator("#support-message").fill("Where is my widget?");
    await page.locator("#contact-support").click();
    await expect(page.locator("#help-status")).toHaveText("SUPPORT_SENT");
  });

  test("blog posts 2 and 3 update status", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-blog").click();
    await page.locator("#read-post-2").click();
    await expect(page.locator("#blog-status")).toHaveText("POST_2");
    await page.locator("#read-post-3").click();
    await expect(page.locator("#blog-status")).toHaveText("POST_3");
  });

  test("clear wishlist and compare", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-widget-b").click();
    await page.locator("#add-to-wishlist").click();
    await page.locator("#add-to-compare").click();
    await page.locator("#nav-wishlist").click();
    await expect(page.locator("#wishlist-list li")).toHaveCount(1);
    await page.locator("#clear-wishlist").click();
    await expect(page.locator("#wishlist-list li")).toHaveCount(0);
    await page.locator("#nav-compare").click();
    await expect(page.locator("#compare-list li")).toHaveCount(1);
    await page.locator("#clear-compare").click();
    await expect(page.locator("#compare-list li")).toHaveCount(0);
  });

  test("survey dismiss hides the modal", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#open-survey").click();
    const modal = page.locator("#survey-block");
    if (await modal.isVisible()) {
      await page.locator("#survey-dismiss").click();
      await expect(modal).toBeHidden();
    } else {
      await expect(modal).toBeHidden();
    }
  });

  test("closing the checkout modal hides the crash text container", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal")).toBeVisible();
    await page.locator("#close-modal").click();
    await expect(page.locator("#checkout-modal")).toBeHidden();
  });

  test("size and color selects do not change the crash", async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
    await page.locator("#nav-shop").click();
    await page.locator("#open-crash-widget").click();
    await page.locator("#product-color").selectOption("black");
    await page.locator("#product-size").selectOption("L");
    await page.locator("#add-to-cart").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();
    await expect(page.locator("#checkout-modal-text")).toContainText("PAYMENT_GATEWAY_CRASH");
  });
});
