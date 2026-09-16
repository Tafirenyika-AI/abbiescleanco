import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_DEMO_EMAIL;
const password = process.env.ADMIN_DEMO_PASSWORD;

test.describe("Admin pricing management", () => {
  test.skip(
    !email || !password,
    "Set ADMIN_DEMO_EMAIL/ADMIN_DEMO_PASSWORD in the environment to run this suite (see .env.example)."
  );

  test("an admin can edit a service's price and see it reflected immediately in the estimate wizard", async ({ page }) => {
    // Log in
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/admin$/);

    // Edit Standard Cleaning's base range to a value nothing else would
    // produce, so we can unambiguously confirm it round-trips.
    await page.goto("/admin/pricing");
    const standardDetails = page.locator("details", { hasText: "Standard Cleaning" }).first();
    await standardDetails.locator("summary").click();
    const baseLow = standardDetails.locator("label", { hasText: "Base price — low" }).locator("input");
    const baseHigh = standardDetails.locator("label", { hasText: "Base price — high" }).locator("input");
    await baseLow.fill("321");
    await baseHigh.fill("432");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved — live on the site now.")).toBeVisible({ timeout: 10_000 });

    // The full estimate wizard (server-fetches pricing fresh every request)
    // should reflect it right away, with no rebuild/redeploy.
    await page.goto("/estimate");
    await page.getByLabel("ZIP code").fill("99206");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator('input[name="firstName"]').fill("Admin");
    await page.locator('input[name="lastName"]').fill("QA");
    await page.locator('input[name="phone"]').fill("5095550002");
    await page.locator('input[name="email"]').fill(`admin-pricing-e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("$321–$432")).toBeVisible();

    // Restore the confirmed real rate so the mock store isn't left dirty
    // for the next run.
    await page.goto("/admin/pricing");
    const standardDetailsAgain = page.locator("details", { hasText: "Standard Cleaning" }).first();
    await standardDetailsAgain.locator("summary").click();
    await standardDetailsAgain.locator("label", { hasText: "Base price — low" }).locator("input").fill("150");
    await standardDetailsAgain.locator("label", { hasText: "Base price — high" }).locator("input").fill("200");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved — live on the site now.")).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated requests to the pricing API are rejected", async ({ request }) => {
    const res = await request.get("/api/admin/pricing");
    expect(res.status()).toBe(401);
  });
});
