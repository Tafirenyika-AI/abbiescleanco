/** Client-safe (no server imports) so forms, tables and emails share one list. */
export const PAYMENT_METHODS = ["CARD", "ZELLE", "VENMO", "APPLE_CASH", "CHECK", "CASH", "OTHER"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<PaymentMethodValue, string> = {
  CARD: "Card (Stripe)",
  ZELLE: "Zelle",
  VENMO: "Venmo",
  APPLE_CASH: "Apple Cash",
  CHECK: "Check",
  CASH: "Cash",
  OTHER: "Other",
};

/** What the optional "reference" field means for each method, so the form can label it sensibly. */
export const paymentReferenceLabels: Record<PaymentMethodValue, string> = {
  CARD: "Reference (optional)",
  ZELLE: "Zelle confirmation # (optional)",
  VENMO: "Venmo transaction ID / @handle (optional)",
  APPLE_CASH: "Apple Cash note (optional)",
  CHECK: "Check number (optional)",
  CASH: "Received by / note (optional)",
  OTHER: "Reference (optional)",
};

export function labelForMethod(method: string | null | undefined): string {
  if (!method) return "—";
  return paymentMethodLabels[method as PaymentMethodValue] ?? method;
}
