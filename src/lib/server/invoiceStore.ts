import { prisma, isDatabaseConfigured } from "@/lib/db";
import { type InvoiceStatusValue, type InvoiceListItem, type InvoiceDetail, type InvoiceableQuote } from "@/lib/invoices";

export { INVOICE_STATUSES, invoiceStatusLabels, type InvoiceStatusValue, type InvoiceListItem, type InvoiceDetail, type InvoiceableQuote } from "@/lib/invoices";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Invoices require DATABASE_URL to be configured.");
  return prisma;
}

/**
 * INV-{year}-{6 random hex}, mirroring generateReference()'s convention already used for leads
 * and bookings elsewhere in this app -- not a strictly sequential counter. If the business's
 * accountant needs invoice numbers to be sequential for tax-filing reasons in their jurisdiction,
 * this is the one thing here that would need to change to a real atomic counter.
 */
function generateInvoiceNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `INV-${year}-${random}`;
}

interface PaymentTotals {
  grossPaid: number;
  refunded: number;
  netPaid: number;
  tip: number;
}

/**
 * Payments are always recorded against a bookingId (both recordPayment and
 * createPendingStripePayment require one -- there's no path to record a payment without a real
 * booking), so bookingId is the correct, and only, join key here. An invoice with no bookingId
 * (e.g. a commercial job invoiced before a booking is scheduled) structurally can't have any
 * payments yet either, for the same reason -- $0 paid is the honest answer for it, not a bug.
 */
async function paymentTotalsForBooking(bookingId: string | null): Promise<PaymentTotals> {
  if (!bookingId) return { grossPaid: 0, refunded: 0, netPaid: 0, tip: 0 };
  const payments = await db().payment.findMany({ where: { bookingId, status: "PAID" } });
  const grossPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const refunded = payments.reduce((sum, p) => sum + p.refundAmount, 0);
  const tip = payments.reduce((sum, p) => sum + p.tipAmount, 0);
  return { grossPaid, refunded, netPaid: grossPaid - refunded, tip };
}

/** Derives the real invoice status from live payment data -- never hand-set, always recomputed. */
function deriveStatus(opts: { cancelled: boolean; total: number; dueDate: Date | null; totals: PaymentTotals }): InvoiceStatusValue {
  if (opts.cancelled) return "CANCELLED";
  const { netPaid, refunded, grossPaid } = opts.totals;
  const isOverdue = !!opts.dueDate && opts.dueDate < new Date();
  if (refunded > 0 && netPaid <= 0 && grossPaid > 0) return "REFUNDED";
  if (opts.total > 0 && netPaid >= opts.total) return "PAID";
  if (netPaid > 0) return isOverdue ? "OVERDUE" : "PARTIALLY_PAID";
  return isOverdue ? "OVERDUE" : "UNPAID";
}

/** Persists the freshly-derived status so it stays queryable/filterable without a live join everywhere. */
async function syncStatus(invoiceId: string, status: InvoiceStatusValue, current: InvoiceStatusValue) {
  if (status === current) return;
  await db().invoice.update({ where: { id: invoiceId }, data: { status } });
}

export async function listInvoices(): Promise<InvoiceListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const invoices = await prisma.invoice.findMany({
    include: { quote: true, booking: true, customer: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return Promise.all(
    invoices.map(async (inv) => {
      const totals = await paymentTotalsForBooking(inv.bookingId);
      const status = deriveStatus({ cancelled: inv.status === "CANCELLED", total: inv.quote.total, dueDate: inv.dueDate, totals });
      await syncStatus(inv.id, status, inv.status);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        customerName: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
        quoteNumber: inv.quote.quoteNumber,
        bookingReference: inv.booking?.reference ?? null,
        total: inv.quote.total,
        paidAmount: totals.netPaid,
        balance: Math.max(0, inv.quote.total - totals.netPaid),
      };
    })
  );
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      quote: { include: { items: true } },
      booking: { include: { address: true } },
      customer: true,
    },
  });
  if (!inv) return null;

  const payments = inv.bookingId ? await prisma.payment.findMany({ where: { bookingId: inv.bookingId }, orderBy: { createdAt: "desc" } }) : [];
  const totals = await paymentTotalsForBooking(inv.bookingId);
  const status = deriveStatus({ cancelled: inv.status === "CANCELLED", total: inv.quote.total, dueDate: inv.dueDate, totals });
  await syncStatus(inv.id, status, inv.status);
  const addr = inv.booking?.address;

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    notes: inv.notes,
    customerName: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
    customerEmail: inv.customer.email,
    customerPhone: inv.customer.phone,
    billingAddress: addr ? `${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}, ${addr.city}, ${addr.state} ${addr.zip}` : null,
    quoteId: inv.quoteId,
    quoteNumber: inv.quote.quoteNumber,
    bookingId: inv.bookingId,
    bookingReference: inv.booking?.reference ?? null,
    subtotal: inv.quote.subtotal,
    discount: inv.quote.discount,
    tax: inv.quote.tax,
    total: inv.quote.total,
    tipAmount: totals.tip,
    paidAmount: totals.netPaid,
    balance: Math.max(0, inv.quote.total - totals.netPaid),
    items: inv.quote.items.map((i) => ({ id: i.id, label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
    payments: payments.map((p) => ({ id: p.id, amount: p.amount, status: p.status, method: p.method, createdAt: p.createdAt.toISOString() })),
  };
}

export interface CreateInvoiceResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Issues an invoice against an ACCEPTED quote -- invoicing something that was never agreed to
 * isn't a real invoice, so this deliberately doesn't allow it. Line items are never copied; the
 * invoice always reads live from the quote, so there is exactly one place amounts can be edited.
 */
export async function createInvoiceFromQuote(
  quoteId: string,
  data: { bookingId?: string; dueDate?: string; notes?: string }
): Promise<CreateInvoiceResult> {
  const quote = await db().quote.findFirst({ where: { id: quoteId, deletedAt: null }, include: { lead: true } });
  if (!quote) return { ok: false, error: "Quote not found" };
  if (quote.status !== "ACCEPTED") return { ok: false, error: "Only accepted quotes can be invoiced." };
  if (!quote.lead.customerId) return { ok: false, error: "This quote's lead has no linked customer to bill." };

  if (data.bookingId) {
    const booking = await db().booking.findUnique({ where: { id: data.bookingId } });
    if (!booking) return { ok: false, error: "Booking not found" };
  }

  const invoice = await db().invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(),
      quoteId,
      bookingId: data.bookingId || null,
      customerId: quote.lead.customerId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes?.trim() || null,
      status: "UNPAID",
    },
  });
  return { ok: true, id: invoice.id };
}

export async function voidInvoice(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().invoice.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Not found" };
  if (existing.status === "CANCELLED") return { ok: true };
  await db().invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  return { ok: true };
}

/** Quotes eligible to be invoiced (ACCEPTED, not already invoiced) -- used by the "New invoice" picker. */
export async function listInvoiceableQuotes(): Promise<InvoiceableQuote[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const quotes = await prisma.quote.findMany({
    where: { status: "ACCEPTED", deletedAt: null, invoices: { none: {} } },
    include: { lead: { include: { customer: true } }, bookings: { take: 1, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerName: q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "—",
    total: q.total,
    bookingId: q.bookings[0]?.id ?? null,
    bookingReference: q.bookings[0]?.reference ?? null,
  }));
}
