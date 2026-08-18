import { test, expect } from "@playwright/test";

/**
 * Killer demo: a deliberately bloated checkout journey.
 *
 * A real user (or codegen) wandered through cookies, newsletter, blog,
 * account settings, help, compare, filters, and two unrelated products
 * before hitting the deterministic payment-gateway crash.
 *
 * ReproMin should strip this down to the handful of actions that
 * actually put crash-widget + SAVE20 through Place order.
 */
test.describe("killer demo", () => {
  test("checkout crashes", async ({ page }) => {
    // 1. Land on the storefront and dismiss the first-run chrome.
    await page.goto("/");
    await page.locator("#cookie-settings").click();
    await page.locator("#accept-cookies").click();

    // 2. Home-page marketing widgets. None of these touch checkout math.
    await page.locator("#promo-summer").click();
    await page.locator("#promo-clearance").click();
    await page.locator("#promo-new").click();
    await page.locator("#open-newsletter").click();
    await page.locator("#newsletter-email").fill("spam@example.com");
    await page.locator("#newsletter-submit").click();

    // 3. Browse help and blog the way a confused shopper might.
    await page.locator("#nav-help").click();
    await page.locator("#faq-shipping").click();
    await page.locator("#faq-returns").click();
    await page.locator("#faq-billing").click();
    await page.locator("#support-message").fill("Do you ship crash widgets overnight?");
    await page.locator("#contact-support").click();
    await page.locator("#nav-blog").click();
    await page.locator("#read-post-1").click();
    await page.locator("#read-post-2").click();
    await page.locator("#read-post-3").click();

    // 4. Tinker with the account surface. Still unrelated to the crash.
    await page.locator("#nav-account").click();
    await page.locator("#profile-name").fill("Casey Checkout");
    await page.locator("#profile-phone").fill("555-0100");
    await page.locator("#save-profile").click();
    await page.locator("#open-addresses").click();
    await page.locator("#open-payments").click();

    // 5. Window-shop two harmless products and stash them on side lists.
    await page.locator("#nav-shop").click();
    await page.locator("#search").fill("gadget");
    await page.locator("#search-btn").click();
    await page.locator("#filter-gadgets").check();
    await page.locator("#sort").selectOption("price");
    await page.locator("#open-gadget-c").click();
    await page.locator("#product-qty").fill("2");
    await page.locator("#product-color").selectOption("blue");
    await page.locator("#product-size").selectOption("L");
    await page.locator("#add-to-wishlist").click();
    await page.locator("#add-to-compare").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#search").fill("");
    await page.locator("#search-btn").click();
    await page.locator("#clear-filters").click();
    await page.locator("#filter-widgets").check();
    await page.locator("#open-widget-a").click();
    await page.locator("#add-to-compare").click();
    await page.locator("#back-to-shop").click();
    await page.locator("#nav-compare").click();
    await page.locator("#nav-wishlist").click();

    // 6. Currency toggle and another pass through the grid.
    await page.locator("#currency").selectOption("EUR");
    await page.locator("#nav-shop").click();
    await page.locator("#filter-in-stock").check();
    await page.locator("#sort").selectOption("name");

    // 7. The only product that participates in the NaN crash.
    await page.locator("#open-crash-widget").click();
    await page.locator("#product-color").selectOption("black");
    await page.locator("#add-to-cart").click();

    // 8. Cart hygiene that does not change the SKU set.
    await page.locator("#nav-cart").click();
    await page.locator("#continue-shopping").click();
    await page.locator("#nav-cart").click();
    await page.locator("#cart-checkout").click();

    // 9. A realistic checkout form, most fields unused by the bug.
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

    // 10. The promo + place-order pair that detonates the gateway.
    await page.locator("#promo").fill("SAVE20");
    await page.locator("#place-order").click();

    await expect(page.locator("#checkout-modal-text")).toHaveText("ORDER_PLACED");

    // Intentionally verbose notes so the unreduced file is painful to read
    // in review, the way a recorded codegen session usually is:
    //
    // The cookie banner is a red herring. Accepting it only hides chrome.
    // Newsletter, blog, help, and account writes never touch cart math.
    // Filters, compare, and wishlist do not change the crash-widget SKU.
    // Address / card fields are ignored by the broken total calculator.
    // The NaN is: crash-widget in cart + promo SAVE20 + Place order.
    //
    // If you are reading the minimized output instead, those sentences
    // should be gone and only the failure-preserving actions remain.
    //
    // Extra blank commentary keeps the original well above 150 lines
    // without adding extra runtime. Real recorded tests look like this
    // because people leave comments, skipped ideas, and journey notes
    // in the spec while they are still hunting the bug by hand.
    //
    // Recording log (not executed — comments only):
    // [00:00] opened storefront
    // [00:04] dismissed cookie settings after opening the panel
    // [00:09] clicked three homepage promo tiles
    // [00:15] subscribed to the newsletter with a dummy address
    // [00:22] read shipping / returns / billing FAQ entries
    // [00:31] filed a support message about overnight crash-widget shipping
    // [00:40] opened three blog posts and did not assert on any of them
    // [00:51] saved a display name and peeked at addresses + payments
    // [01:02] searched gadgets, sorted by price, wishlisted gadget C
    // [01:11] compared widget A, toggled currency to EUR
    // [01:18] opened crash-widget, left color on black, added to cart
    // [01:24] bounced through continue-shopping and back to cart
    // [01:29] filled a complete billing form the gateway never reads
    // [01:36] typed SAVE20 and placed the order
    // [01:37] expected ORDER_PLACED, received PAYMENT_GATEWAY_CRASH
    //
    // Why this file is long on purpose:
    // codegen + exploratory clicking produces exactly this kind of spec.
    // Reviewers should see a painful before and a tiny after.
    // The comments themselves are not actions and must not affect ddmin.
    // If they survive minimization they are only attached trivia.
    // That is acceptable. Action count is what the thesis measures.
    // Line count is only here so the before/after screenshot is honest.
    //
    // End of padding.
  });
});
