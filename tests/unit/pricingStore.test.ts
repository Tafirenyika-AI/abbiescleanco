import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { getPricingConfig, savePricingConfig } from "@/lib/server/pricingStore";
import { defaultPricingConfig } from "@/lib/pricing";

const mockPricingFile = path.join(process.cwd(), ".data", "pricing-config.json");

describe("pricingStore (mock JSON path — no DATABASE_URL in test env)", () => {
  beforeEach(async () => {
    await fs.rm(mockPricingFile, { force: true });
  });

  it("returns the built-in defaults when nothing has been saved yet", async () => {
    const config = await getPricingConfig();
    expect(config.services["standard-cleaning"].baseLow).toBe(150);
    expect(config.services["standard-cleaning"].baseHigh).toBe(200);
  });

  it("persists an admin edit and returns it on the next read", async () => {
    const edited = structuredClone(defaultPricingConfig);
    edited.services["deep-cleaning"].baseLow = 300;
    edited.addOns.push({ key: "custom-addon", label: "Custom add-on", low: 10, high: 20 });
    edited.recurringDiscountsEnabled = true;
    edited.recurringDiscountRates.weekly = 0.2;

    await savePricingConfig(edited);
    const reloaded = await getPricingConfig();

    expect(reloaded.services["deep-cleaning"].baseLow).toBe(300);
    expect(reloaded.addOns.some((a) => a.key === "custom-addon")).toBe(true);
    expect(reloaded.recurringDiscountsEnabled).toBe(true);
    expect(reloaded.recurringDiscountRates.weekly).toBe(0.2);
  });

  it("fills in defaults for any service missing from a saved override", async () => {
    const partial = structuredClone(defaultPricingConfig);
    // @ts-expect-error — simulating a saved file from before a new service existed
    delete partial.services["kitchen-deep-cleaning"];
    await fs.mkdir(path.dirname(mockPricingFile), { recursive: true });
    await fs.writeFile(mockPricingFile, JSON.stringify(partial), "utf-8");

    const config = await getPricingConfig();
    expect(config.services["kitchen-deep-cleaning"]).toBeDefined();
    expect(config.services["kitchen-deep-cleaning"].baseLow).toBe(90);
  });
});
