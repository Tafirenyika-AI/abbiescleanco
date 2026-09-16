import { describe, it, expect } from "vitest";
import { calculateEstimate } from "@/lib/pricing";

const baseInput = {
  service: "standard-cleaning" as const,
  propertyType: "house" as const,
  squareFeet: 1500,
  bedrooms: 3,
  bathrooms: 2,
  condition: "normal" as const,
  frequency: "one-time" as const,
  hasPets: false,
  addOns: [],
};

describe("calculateEstimate", () => {
  it("returns the published base range for a typical home", () => {
    const result = calculateEstimate(baseInput);
    expect(result.requiresManualQuote).toBe(false);
    expect(result.low).toBe(150);
    expect(result.high).toBe(200);
    expect(result.totalLow).toBe(150);
    expect(result.totalHigh).toBe(200);
  });

  it("increases price for extra bedrooms and bathrooms", () => {
    const result = calculateEstimate({ ...baseInput, bedrooms: 5, bathrooms: 4 });
    expect(result.low).toBeGreaterThan(150);
    expect(result.high).toBeGreaterThan(200);
  });

  it("applies the condition multiplier", () => {
    const normal = calculateEstimate(baseInput);
    const heavy = calculateEstimate({ ...baseInput, condition: "heavy" });
    expect(heavy.low).toBeGreaterThan(normal.low);
    expect(heavy.high).toBeGreaterThan(normal.high);
  });

  it("adds add-on pricing on top of the base range", () => {
    const withAddOns = calculateEstimate({ ...baseInput, addOns: ["insideOven", "insideFridge"] });
    const without = calculateEstimate(baseInput);
    expect(withAddOns.totalLow).toBeGreaterThan(without.totalLow);
    expect(withAddOns.totalHigh).toBeGreaterThan(without.totalHigh);
  });

  it("requires a manual quote for commercial properties", () => {
    const result = calculateEstimate({ ...baseInput, propertyType: "commercial" });
    expect(result.requiresManualQuote).toBe(true);
    expect(result.totalLow).toBe(0);
    expect(result.totalHigh).toBe(0);
  });

  it("requires a manual quote above the size threshold", () => {
    const result = calculateEstimate({ ...baseInput, squareFeet: 10000 });
    expect(result.requiresManualQuote).toBe(true);
  });

  it("never produces a negative or NaN estimate", () => {
    const result = calculateEstimate({ ...baseInput, bedrooms: 0, bathrooms: 0, squareFeet: 100 });
    expect(Number.isFinite(result.low)).toBe(true);
    expect(Number.isFinite(result.high)).toBe(true);
    expect(result.low).toBeGreaterThanOrEqual(0);
  });
});
