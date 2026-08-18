import { test, expect } from "@playwright/test";

test.describe("fixture D", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#accept-cookies").click();
  });

  test("secret panel assertion", async ({ page }) => {
    await page.locator("#nav-help").click();
    await page.locator("#faq-shipping").click();
    await page.locator("#faq-returns").click();
    await page.locator("#open-secret").click();
    await page.locator("#reveal-secret").click();
    await page.locator("#confirm-reveal").click();
    await expect(page.locator("#secret-panel")).toHaveText("SECRET_PANEL_OK");
  });
});
