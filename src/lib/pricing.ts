import type { ServiceId } from "@/lib/data/services";

/**
 * Preliminary-estimate pricing configuration.
 *
 * This is intentionally the single source of truth for every number the
 * estimator shows — nothing in the UI should hardcode a dollar figure.
 * In Phase 3 this shape should move into the `pricing_rules` admin-managed
 * database table (see prisma/schema.prisma) so the business can update rates
 * without a code deploy; the estimator's calculation logic will not need to
 * change, only where these values are read from.
 *
 * Base ranges below are anchored to the price ranges already published by
 * the business on its current site for a typical ~1,500 sq ft, 3-bed/2-bath
 * home. CONFIRM ALL RATES WITH THE CLIENT BEFORE LAUNCH — see
 * CLIENT_CONFIRMATION_CHECKLIST.md.
 */

export type PropertyType = "apartment" | "house" | "townhome" | "commercial";
export type Frequency = "one-time" | "weekly" | "biweekly" | "every-4-weeks" | "custom";
export type Condition = "light" | "normal" | "heavy" | "very-heavy";

export const conditionLabels: Record<Condition, string> = {
  light: "Well-maintained, light upkeep",
  normal: "Normal, everyday condition",
  heavy: "Hasn't been cleaned in a while",
  "very-heavy": "Needs significant attention",
};

export const frequencyLabels: Record<Frequency, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  biweekly: "Every two weeks",
  "every-4-weeks": "Every four weeks",
  custom: "Custom schedule",
};

interface ServicePricing {
  baseLow: number;
  baseHigh: number;
  /** Baseline the base range assumes, before per-bedroom/bathroom/sqft adjustments. */
  baseBedrooms: number;
  baseBathrooms: number;
  baseSqFt: number;
  perExtraBedroom: number;
  perExtraBathroom: number;
  /** Added per sq ft beyond baseSqFt. */
  perExtraSqFt: number;
  /** Above this sq ft, we don't auto-price — a manual quote is required. */
  manualQuoteAboveSqFt: number;
  durationHoursLow: number;
  durationHoursHigh: number;
}

export const servicePricing: Record<ServiceId, ServicePricing> = {
  "standard-cleaning": { baseLow: 150, baseHigh: 200, baseBedrooms: 3, baseBathrooms: 2, baseSqFt: 1500, perExtraBedroom: 15, perExtraBathroom: 20, perExtraSqFt: 0.05, manualQuoteAboveSqFt: 4000, durationHoursLow: 2, durationHoursHigh: 3 },
  "residential-cleaning": { baseLow: 150, baseHigh: 200, baseBedrooms: 3, baseBathrooms: 2, baseSqFt: 1500, perExtraBedroom: 15, perExtraBathroom: 20, perExtraSqFt: 0.05, manualQuoteAboveSqFt: 4000, durationHoursLow: 2, durationHoursHigh: 3 },
  "deep-cleaning": { baseLow: 225, baseHigh: 450, baseBedrooms: 3, baseBathrooms: 2, baseSqFt: 1500, perExtraBedroom: 25, perExtraBathroom: 35, perExtraSqFt: 0.09, manualQuoteAboveSqFt: 3500, durationHoursLow: 3, durationHoursHigh: 6 },
  "move-in-cleaning": { baseLow: 250, baseHigh: 400, baseBedrooms: 3, baseBathrooms: 2, baseSqFt: 1500, perExtraBedroom: 25, perExtraBathroom: 35, perExtraSqFt: 0.08, manualQuoteAboveSqFt: 3500, durationHoursLow: 3, durationHoursHigh: 6 },
  "move-out-cleaning": { baseLow: 300, baseHigh: 500, baseBedrooms: 3, baseBathrooms: 2, baseSqFt: 1500, perExtraBedroom: 30, perExtraBathroom: 40, perExtraSqFt: 0.09, manualQuoteAboveSqFt: 3500, durationHoursLow: 3, durationHoursHigh: 6 },
  "bathroom-deep-cleaning": { baseLow: 80, baseHigh: 150, baseBedrooms: 0, baseBathrooms: 1, baseSqFt: 0, perExtraBedroom: 0, perExtraBathroom: 55, perExtraSqFt: 0, manualQuoteAboveSqFt: 999999, durationHoursLow: 1, durationHoursHigh: 2 },
  "kitchen-deep-cleaning": { baseLow: 90, baseHigh: 160, baseBedrooms: 0, baseBathrooms: 0, baseSqFt: 0, perExtraBedroom: 0, perExtraBathroom: 0, perExtraSqFt: 0, manualQuoteAboveSqFt: 999999, durationHoursLow: 1, durationHoursHigh: 2 },
  "laundry-organization": { baseLow: 60, baseHigh: 150, baseBedrooms: 0, baseBathrooms: 0, baseSqFt: 0, perExtraBedroom: 0, perExtraBathroom: 0, perExtraSqFt: 0, manualQuoteAboveSqFt: 999999, durationHoursLow: 1, durationHoursHigh: 3 },
  "commercial-cleaning": { baseLow: 0, baseHigh: 0, baseBedrooms: 0, baseBathrooms: 0, baseSqFt: 0, perExtraBedroom: 0, perExtraBathroom: 0, perExtraSqFt: 0, manualQuoteAboveSqFt: 0, durationHoursLow: 0, durationHoursHigh: 0 },
};

export const conditionMultiplier: Record<Condition, number> = {
  light: 0.92,
  normal: 1,
  heavy: 1.25,
  "very-heavy": 1.5,
};

export const addOnPricing = {
  insideFridge: { label: "Inside refrigerator", low: 25, high: 40 },
  insideOven: { label: "Inside oven", low: 25, high: 50 },
  interiorWindows: { label: "Interior windows", low: 50, high: 90 },
  insideCabinets: { label: "Inside cabinets", low: 30, high: 60 },
  baseboards: { label: "Baseboards detail pass", low: 20, high: 40 },
  laundry: { label: "Laundry (wash & fold)", low: 20, high: 45 },
  organization: { label: "Organization", low: 30, high: 75 },
  petHairTreatment: { label: "Pet-hair treatment", low: 25, high: 45 },
  dishes: { label: "Dishes (wash & put away)", low: 15, high: 30 },
  sameDayUrgent: { label: "Same-day / urgent service", low: 40, high: 80 },
} as const;

export type AddOnKey = keyof typeof addOnPricing;

/**
 * Recurring-frequency discounts are NOT enabled. Do not surface any savings
 * language until the client explicitly approves specific discount rates.
 */
export const recurringDiscountsEnabled = false;
export const recurringDiscountRates: Record<Frequency, number> = {
  "one-time": 0,
  weekly: 0.15,
  biweekly: 0.1,
  "every-4-weeks": 0.05,
  custom: 0,
};

export interface EstimateInput {
  service: ServiceId;
  propertyType: PropertyType;
  squareFeet: number;
  bedrooms: number;
  bathrooms: number;
  condition: Condition;
  frequency: Frequency;
  hasPets: boolean;
  addOns: AddOnKey[];
}

export interface EstimateResult {
  requiresManualQuote: boolean;
  low: number;
  high: number;
  addOnsLow: number;
  addOnsHigh: number;
  totalLow: number;
  totalHigh: number;
  durationHoursLow: number;
  durationHoursHigh: number;
  breakdown: { label: string; low: number; high: number }[];
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const pricing = servicePricing[input.service];

  if (input.propertyType === "commercial" || input.service === "commercial-cleaning") {
    return manualQuoteResult();
  }

  if (input.squareFeet > pricing.manualQuoteAboveSqFt) {
    return manualQuoteResult();
  }

  const extraBedrooms = Math.max(0, input.bedrooms - pricing.baseBedrooms);
  const extraBathrooms = Math.max(0, input.bathrooms - pricing.baseBathrooms);
  const extraSqFt = Math.max(0, input.squareFeet - pricing.baseSqFt);

  const sizeAdjustment =
    extraBedrooms * pricing.perExtraBedroom +
    extraBathrooms * pricing.perExtraBathroom +
    extraSqFt * pricing.perExtraSqFt;

  const multiplier = conditionMultiplier[input.condition];

  let low = (pricing.baseLow + sizeAdjustment) * multiplier;
  let high = (pricing.baseHigh + sizeAdjustment) * multiplier;

  const breakdown: EstimateResult["breakdown"] = [
    { label: "Base service range", low: Math.round(pricing.baseLow), high: Math.round(pricing.baseHigh) },
  ];
  if (sizeAdjustment > 0) {
    breakdown.push({ label: "Size adjustment (bedrooms/bathrooms/sq ft)", low: Math.round(sizeAdjustment * multiplier * 0.5), high: Math.round(sizeAdjustment * multiplier) });
  }

  if (input.hasPets) {
    low += 10;
    high += 15;
    breakdown.push({ label: "Pet-aware cleaning consideration", low: 10, high: 15 });
  }

  let addOnsLow = 0;
  let addOnsHigh = 0;
  for (const key of input.addOns) {
    const addOn = addOnPricing[key];
    addOnsLow += addOn.low;
    addOnsHigh += addOn.high;
  }

  return {
    requiresManualQuote: false,
    low: Math.round(low),
    high: Math.round(high),
    addOnsLow,
    addOnsHigh,
    totalLow: Math.round(low) + addOnsLow,
    totalHigh: Math.round(high) + addOnsHigh,
    durationHoursLow: pricing.durationHoursLow,
    durationHoursHigh: pricing.durationHoursHigh,
    breakdown,
  };
}

function manualQuoteResult(): EstimateResult {
  return {
    requiresManualQuote: true,
    low: 0,
    high: 0,
    addOnsLow: 0,
    addOnsHigh: 0,
    totalLow: 0,
    totalHigh: 0,
    durationHoursLow: 0,
    durationHoursHigh: 0,
    breakdown: [],
  };
}
