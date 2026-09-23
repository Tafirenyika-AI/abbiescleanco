import { prisma, isDatabaseConfigured } from "@/lib/db";
import { type InvoiceStatusValue, type InvoiceListItem, type InvoiceDetail, type InvoiceableQuote } from "@/lib/invoices";

export { INVOICE_STATUSES, type InvoiceStatusValue, type InvoiceListItem, type InvoiceDetail, type InvoiceableQuote } from "@/lib/invoices";

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

async function paidAmountForBooking(bookingId: string | null): Promise<number> {
  if (!bookingId) return 0;
  const payments = await db().payment.findMany({ where: { bookingId, status: "PAID" } });
  return payments.reduce((sum, p) => sum + p.amount, 0);
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
      const paidAmount = await paidAmountForBooking(inv.bookingId);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status as InvoiceStatusValue,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        customerName: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
        quoteNumber: inv.quote.quoteNumber,
        bookingReference: inv.booking?.reference ?? null,
        total: inv.quote.total,
        paidAmount,
        balance: Math.max(0, inv.quote.total - paidAmount),
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
  const paidAmount = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const addr = inv.booking?.address;

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status as InvoiceStatusValue,
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
    paidAmount,
    balance: Math.max(0, inv.quote.total - paidAmount),
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
    },
  });
  return { ok: true, id: invoice.id };
}

export async function voidInvoice(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().invoice.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Not found" };
  if (existing.status === "VOID") return { ok: true };
  await db().invoice.update({ where: { id }, data: { status: "VOID" } });
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
