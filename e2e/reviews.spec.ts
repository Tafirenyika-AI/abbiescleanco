import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_DEMO_EMAIL;
const password = process.env.ADMIN_DEMO_PASSWORD;

test.describe("Reviews", () => {
  test("a visitor can submit a review directly from the Reviews page (not redirected to Contact)", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page).toHaveURL(/\/reviews$/);

    const stars = page.locator('[role="radio"]');
    await stars.nth(3).click(); // 4th star = 4-star rating

    const uniqueName = `E2E Reviewer ${Date.now()}`;
    await page.locator("label:has-text('Your name') input").fill(uniqueName);
    await page.locator("label:has-text('Location') input").fill("Spokane Valley, WA");
    await page
      .locator("textarea")
      .fill("Submitted by the automated end-to-end test to confirm the review form works without redirecting to /contact.");

    await page.locator('button:has-text("Submit review")').click({ noWaitAfter: true }).catch(() => {});

    await expect(page.getByText("Thank you for sharing your experience!")).toBeVisible({ timeout: 10_000 });
    // The whole point of this test: submitting a review keeps you on /reviews.
    await expect(page).toHaveURL(/\/reviews$/);
  });

  test.skip(!email || !password, "Set ADMIN_DEMO_EMAIL/ADMIN_DEMO_PASSWORD to run the moderation half of this suite.");

  test("an admin can publish a submitted review and it appears on the public Reviews page", async ({ page }) => {
    const uniqueName = `E2E Moderated ${Date.now()}`;

    await page.goto("/reviews");
    const stars = page.locator('[role="radio"]');
    await stars.nth(4).click(); // 5 stars
    await page.locator("label:has-text('Your name') input").fill(uniqueName);
    await page
      .locator("textarea")
      .fill("This review should show up publicly only after an admin approves it in the moderation queue.");
    await page.locator('button:has-text("Submit review")').click({ noWaitAfter: true }).catch(() => {});
    await expect(page.getByText("Thank you for sharing your experience!")).toBeVisible({ timeout: 10_000 });

    // Not published yet — shouldn't appear on a fresh load of the page.
    await page.goto("/reviews");
    await expect(page.getByText(uniqueName)).toHaveCount(0);

    // Admin approves it.
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/);

    await page.goto("/admin/reviews");
    const row = page.locator("div.rounded-2xl.border-slate-200").filter({ hasText: uniqueName });
    await row.getByLabel("Published").check();
    await page.waitForTimeout(500); // fire-and-forget PATCH in the moderation UI

    await page.goto("/reviews");
    await expect(page.getByText(uniqueName)).toBeVisible();
  });
});
