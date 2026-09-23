/** Client-safe invoice types/constants — no server-only imports (Prisma, fs). */

export const INVOICE_STATUSES = ["ISSUED", "VOID"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatusValue;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  quoteNumber: string;
  bookingReference: string | null;
  total: number;
  paidAmount: number;
  balance: number;
}

export interface InvoiceDetail extends InvoiceListItem {
  quoteId: string;
  bookingId: string | null;
  notes: string | null;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  items: { id: string; label: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; amount: number; status: string; method: string | null; createdAt: string }[];
}

export interface InvoiceableQuote {
  id: string;
  quoteNumber: string;
  customerName: string;
  total: number;
  bookingId: string | null;
  bookingReference: string | null;
}
