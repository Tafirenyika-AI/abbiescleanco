/** Client-safe invoice types/constants — no server-only imports (Prisma, fs). */

export const INVOICE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE", "REFUNDED", "CANCELLED"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export const invoiceStatusLabels: Record<InvoiceStatusValue, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

/**
 * Single source of truth for invoice status color-coding -- previously InvoicesView.tsx and
 * InvoiceDetailView.tsx each had their own inline mapping and disagreed with each other (one had
 * PARTIALLY_PAID as blue and REFUNDED as yellow, backwards from the intended meaning; neither
 * gave UNPAID its own color at all). Real business meaning: green = paid in full, yellow = partly
 * paid, red = nothing paid (or overdue), blue = refunded, gray = void.
 */
export const invoiceStatusTone: Record<InvoiceStatusValue, "neutral" | "success" | "warning" | "error" | "info"> = {
  PAID: "success",
  PARTIALLY_PAID: "warning",
  UNPAID: "error",
  OVERDUE: "error",
  REFUNDED: "info",
  CANCELLED: "neutral",
};

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatusValue;
  issueDate: string;
  dueDate: string | null;
  // The real day the job happened (booking.actualEnd/actualStart, falling back to
  // scheduledEnd/scheduledStart), as distinct from issueDate (when the invoice was created) --
  // null when the invoice has no linked booking. See invoiceStore.ts's bookingServiceDate.
  serviceDate: string | null;
  emailedAt: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  quoteNumber: string;
  bookingId: string | null;
  bookingReference: string | null;
  total: number;
  paidAmount: number;
  balance: number;
}

export const INVOICE_PAYMENT_LINK_STATUSES = ["PENDING", "PAID", "VOID"] as const;
export type InvoicePaymentLinkStatusValue = (typeof INVOICE_PAYMENT_LINK_STATUSES)[number];

export const invoicePaymentLinkStatusLabels: Record<InvoicePaymentLinkStatusValue, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  VOID: "Cancelled",
};

export const invoicePaymentLinkStatusTone: Record<InvoicePaymentLinkStatusValue, "neutral" | "success" | "warning" | "error" | "info"> = {
  PENDING: "warning",
  PAID: "success",
  VOID: "neutral",
};

/** A real Stripe Payment Link covering one or more invoices in a single charge -- see
 *  invoicePaymentLinkStore.ts. Shown on each covered invoice's own page as a permanent record of
 *  what was sent and whether it was ever paid. */
export interface InvoicePaymentLinkSummary {
  id: string;
  invoiceIds: string[];
  invoiceNumbers: string[];
  amount: number;
  status: InvoicePaymentLinkStatusValue;
  url: string;
  createdAt: string;
  paidAt: string | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  quoteId: string;
  notes: string | null;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  tipAmount: number;
  items: { id: string; label: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; amount: number; status: string; method: string | null; createdAt: string }[];
  paymentLinks: InvoicePaymentLinkSummary[];
}

export interface InvoiceableQuote {
  id: string;
  quoteNumber: string;
  customerName: string;
  total: number;
  bookingId: string | null;
  bookingReference: string | null;
}

/** A real COMPLETED job whose accepted quote has never been invoiced -- surfaced as its own panel
 *  on the Invoices page so this gap (the real one that prompted this feature) can't silently
 *  recur. See invoiceStore.ts's listCompletedUninvoicedBookings. */
export interface CompletedUninvoicedBooking {
  bookingId: string;
  reference: string;
  customerName: string;
  serviceName: string;
  serviceDate: string | null;
  quoteId: string;
  total: number;
}
