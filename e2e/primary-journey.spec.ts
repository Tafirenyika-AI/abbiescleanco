import { test, expect } from "@playwright/test";

test.describe("Primary customer journey", () => {
  test("visitor can browse the homepage and reach the estimate wizard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your home, spotless." })).toBeVisible();

    await page.getByRole("link", { name: "Get My Free Estimate" }).first().click();
    await expect(page).toHaveURL(/\/estimate/);
    await expect(page.getByRole("heading", { name: "Let's build your estimate" })).toBeVisible();
  });

  test("visitor can complete the estimate wizard and receive a reference number", async ({ page }) => {
    await page.goto("/estimate");

    // Step 1: Property & service
    await page.getByLabel("ZIP code").fill("99206");
    await page.getByLabel("Approximate square footage").fill("1800");
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: Cleaning details — defaults are fine, continue
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: Contact info
    await page.locator('input[name="firstName"]').fill("Jane");
    await page.locator('input[name="lastName"]').fill("Doe");
    await page.locator('input[name="phone"]').fill("5095551234");
    await page.locator('input[name="email"]').fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Next" }).click();

    // Step 4: Review & submit
    await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit request" })).toBeVisible();
    await expect(page.getByText("Preliminary estimate", { exact: true })).toBeVisible();
    await page.locator('input[name="policiesAccepted"]').check();
    // Submitting swaps this button out of the DOM almost immediately (the
    // success state replaces the whole form), which races Playwright's own
    // actionability/stability check on the click and can report a timeout
    // even though the click already landed. The real assertion of interest
    // is the success state below, so a lingering click error here is ignored.
    await page
      .getByRole("button", { name: "Submit request" })
      .click({ noWaitAfter: true, timeout: 5_000 })
      .catch(() => {});

    await expect(page.getByText("Request received!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ACM-\d{2}-[A-Z0-9]{6}/)).toBeVisible();
  });

  test("unauthenticated visitors are redirected away from the admin area", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
