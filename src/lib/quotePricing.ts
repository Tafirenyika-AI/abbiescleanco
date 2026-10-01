/**
 * Single source of truth for how a commercial-cleaning quote's rate is labeled and formatted.
 * Imported by the admin quote builder, the customer-facing quote view (account portal + its print
 * page), and the quote email -- so the builder, preview, email, and print/PDF can never disagree
 * about what a number means. A per-visit rate must never be mistaken for a contract total; this
 * file is the only place that decides how a pricing unit reads.
 */

export const PRICING_UNITS = ["PER_VISIT", "PER_HOUR", "FLAT_PROJECT", "MONTHLY", "CUSTOM"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const pricingUnitLabels: Record<PricingUnit, string> = {
  PER_VISIT: "Per Visit",
  PER_HOUR: "Per Hour",
  FLAT_PROJECT: "Flat Project",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

export const FREQUENCIES = ["ONE_TIME", "WEEKLY", "TWICE_WEEKLY", "THREE_WEEKLY", "FIVE_WEEKLY", "CUSTOM"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const frequencyLabels: Record<Frequency, string> = {
  ONE_TIME: "One Time",
  WEEKLY: "Weekly",
  TWICE_WEEKLY: "Twice per Week",
  THREE_WEEKLY: "Three Times per Week",
  FIVE_WEEKLY: "Five Times per Week",
  CUSTOM: "Custom",
};

/** How a frequency should actually read -- `customText` is required and used when frequency is CUSTOM. */
export function formatFrequency(frequency: string | null | undefined, customText?: string | null): string | null {
  if (!frequency) return null;
  if (frequency === "CUSTOM") return customText?.trim() || "Custom";
  return frequencyLabels[frequency as Frequency] ?? frequency;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The one line that must never be misread as a contract total: "$215.00 / visit", "$45.00 / hour",
 * "$1,200.00 total" (flat project), "$800.00 / month", or the raw amount for CUSTOM (no unit
 * implied -- the custom pricing unit has no fixed cadence to attach "/ x" to).
 */
export function formatQuotedRate(amountCents: number, unit: PricingUnit | string | null | undefined): string {
  const amount = money(amountCents);
  switch (unit) {
    case "PER_VISIT":
      return `${amount} / visit`;
    case "PER_HOUR":
      return `${amount} / hour`;
    case "MONTHLY":
      return `${amount} / month`;
    case "FLAT_PROJECT":
      return `${amount} total`;
    case "CUSTOM":
      return amount;
    default:
      return amount;
  }
}

/** Short unit suffix alone, e.g. "/ visit" -- for compact table cells next to a rate that's already formatted. */
export function pricingUnitSuffix(unit: PricingUnit | string | null | undefined): string {
  switch (unit) {
    case "PER_VISIT":
      return "/ visit";
    case "PER_HOUR":
      return "/ hour";
    case "MONTHLY":
      return "/ month";
    case "FLAT_PROJECT":
      return "total";
    default:
      return "";
  }
}

export interface QuoteTotalsInput {
  items: { quantity: number; unitPrice: number }[];
  discountType: string;
  discountValue: number;
  tax: number;
  depositType: string;
  depositValue: number;
}

/**
 * Resolves a discount/deposit type+value to the actual cents figure it produces against a
 * subtotal. FIXED is already cents; PERCENT is 0-100 of the subtotal; NONE (deposit only) is 0
 * regardless of value. The one place this math happens -- quoteStore.ts (server, authoritative)
 * and the admin quote builder (client, for live totals as you type) both call this, so a draft can
 * never show a number on screen that createQuote/updateDraftQuote would compute differently.
 */
export function resolveAmount(subtotal: number, type: string, value: number): number {
  if (type === "PERCENT") return Math.round(subtotal * (value / 100));
  if (type === "NONE") return 0;
  return value; // FIXED, already cents
}

export function computeQuoteTotals(input: QuoteTotalsInput): { subtotal: number; discount: number; deposit: number; total: number } {
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discount = resolveAmount(subtotal, input.discountType, input.discountValue);
  const deposit = input.depositType === "NONE" ? 0 : resolveAmount(subtotal, input.depositType, input.depositValue);
  const total = Math.max(0, subtotal - discount + input.tax);
  return { subtotal, discount, deposit, total };
}

const VISITS_PER_MONTH: Partial<Record<Frequency, number>> = {
  WEEKLY: 4.33,
  TWICE_WEEKLY: 8.66,
  THREE_WEEKLY: 13,
  FIVE_WEEKLY: 21.67,
};

/**
 * INTERNAL ONLY -- an approximate monthly value for analytics/forecasting, derived from a per-visit
 * or hourly rate and a recurring frequency. Never pass this to anything customer-facing (quote
 * builder's internal-estimate panel, future finance reporting). Returns null when the math isn't
 * meaningful (flat project, custom unit/frequency, one-time).
 */
export function estimateInternalMonthlyValueCents(rateCents: number, unit: PricingUnit | string | null | undefined, frequency: Frequency | string | null | undefined): number | null {
  if (unit !== "PER_VISIT" || !frequency) return null;
  const visits = VISITS_PER_MONTH[frequency as Frequency];
  if (!visits) return null;
  return Math.round(rateCents * visits);
}
