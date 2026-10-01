import { describe, it, expect } from "vitest";
import {
  formatQuotedRate,
  formatFrequency,
  pricingUnitSuffix,
  estimateInternalMonthlyValueCents,
  computeQuoteTotals,
  resolveAmount,
} from "@/lib/quotePricing";

describe("formatQuotedRate", () => {
  // The critical test from the commercial-quote spec: Emma Locsin, $215 PER_VISIT, Twice per Week --
  // this must read as a per-visit rate, never as a contract total.
  it("formats a per-visit rate as '$215.00 / visit', never a bare total", () => {
    const label = formatQuotedRate(21500, "PER_VISIT");
    expect(label).toBe("$215.00 / visit");
    expect(label).not.toBe("$215.00");
    expect(label).not.toMatch(/total/i);
  });

  it("formats an hourly rate as '$X.XX / hour'", () => {
    expect(formatQuotedRate(4500, "PER_HOUR")).toBe("$45.00 / hour");
  });

  it("formats a monthly rate as '$X.XX / month'", () => {
    expect(formatQuotedRate(80000, "MONTHLY")).toBe("$800.00 / month");
  });

  it("formats a flat project rate as '$X.XX total'", () => {
    expect(formatQuotedRate(120000, "FLAT_PROJECT")).toBe("$1200.00 total");
  });

  it("formats a custom pricing unit as a bare amount (no invented unit)", () => {
    expect(formatQuotedRate(5000, "CUSTOM")).toBe("$50.00");
  });

  it("falls back to a bare amount for a legacy item with no pricing unit", () => {
    expect(formatQuotedRate(5000, null)).toBe("$50.00");
    expect(formatQuotedRate(5000, undefined)).toBe("$50.00");
  });
});

describe("pricingUnitSuffix", () => {
  it("returns the right short suffix per unit", () => {
    expect(pricingUnitSuffix("PER_VISIT")).toBe("/ visit");
    expect(pricingUnitSuffix("PER_HOUR")).toBe("/ hour");
    expect(pricingUnitSuffix("MONTHLY")).toBe("/ month");
    expect(pricingUnitSuffix("FLAT_PROJECT")).toBe("total");
    expect(pricingUnitSuffix("CUSTOM")).toBe("");
    expect(pricingUnitSuffix(null)).toBe("");
  });
});

describe("formatFrequency", () => {
  it("labels twice-weekly correctly", () => {
    expect(formatFrequency("TWICE_WEEKLY")).toBe("Twice per Week");
  });
  it("uses the custom text for CUSTOM", () => {
    expect(formatFrequency("CUSTOM", "Every other Tuesday")).toBe("Every other Tuesday");
  });
  it("falls back to 'Custom' if CUSTOM has no text", () => {
    expect(formatFrequency("CUSTOM", null)).toBe("Custom");
  });
  it("returns null for no frequency at all", () => {
    expect(formatFrequency(null)).toBeNull();
    expect(formatFrequency(undefined)).toBeNull();
  });
});

describe("estimateInternalMonthlyValueCents", () => {
  it("computes an internal monthly estimate for a recurring per-visit rate", () => {
    // $215/visit, twice a week -- internal analytics only, never customer-facing
    const estimate = estimateInternalMonthlyValueCents(21500, "PER_VISIT", "TWICE_WEEKLY");
    expect(estimate).not.toBeNull();
    expect(estimate).toBeGreaterThan(21500 * 8); // roughly 8.66 visits/month
  });

  it("returns null for a flat project (no recurring cadence to project)", () => {
    expect(estimateInternalMonthlyValueCents(120000, "FLAT_PROJECT", "ONE_TIME")).toBeNull();
  });

  it("returns null for a custom frequency (no reliable visits/month)", () => {
    expect(estimateInternalMonthlyValueCents(21500, "PER_VISIT", "CUSTOM")).toBeNull();
  });

  it("returns null when there's no frequency at all", () => {
    expect(estimateInternalMonthlyValueCents(21500, "PER_VISIT", null)).toBeNull();
  });
});

describe("resolveAmount / computeQuoteTotals", () => {
  it("resolves a FIXED amount as-is", () => {
    expect(resolveAmount(10000, "FIXED", 1500)).toBe(1500);
  });
  it("resolves a PERCENT amount against the subtotal", () => {
    expect(resolveAmount(10000, "PERCENT", 10)).toBe(1000);
  });
  it("resolves NONE as zero regardless of value", () => {
    expect(resolveAmount(10000, "NONE", 9999)).toBe(0);
  });

  it("computes totals for a single per-visit service line with no discount/tax/deposit", () => {
    const totals = computeQuoteTotals({
      items: [{ quantity: 1, unitPrice: 21500 }],
      discountType: "FIXED", discountValue: 0, tax: 0, depositType: "NONE", depositValue: 0,
    });
    expect(totals).toEqual({ subtotal: 21500, discount: 0, deposit: 0, total: 21500 });
  });

  it("applies a percent discount and a percent deposit correctly", () => {
    const totals = computeQuoteTotals({
      items: [{ quantity: 1, unitPrice: 20000 }],
      discountType: "PERCENT", discountValue: 10, tax: 0, depositType: "PERCENT", depositValue: 50,
    });
    expect(totals.discount).toBe(2000);
    expect(totals.total).toBe(18000);
    expect(totals.deposit).toBe(10000); // 50% of the 20000 subtotal, not of the discounted total
  });

  it("never lets total go negative", () => {
    const totals = computeQuoteTotals({
      items: [{ quantity: 1, unitPrice: 1000 }],
      discountType: "FIXED", discountValue: 5000, tax: 0, depositType: "NONE", depositValue: 0,
    });
    expect(totals.total).toBe(0);
  });

  it("sums multiple line items for a legacy/plain quote (qty x price math)", () => {
    const totals = computeQuoteTotals({
      items: [{ quantity: 2, unitPrice: 5000 }, { quantity: 1, unitPrice: 3000 }],
      discountType: "FIXED", discountValue: 0, tax: 500, depositType: "NONE", depositValue: 0,
    });
    expect(totals.subtotal).toBe(13000);
    expect(totals.total).toBe(13500);
  });
});
