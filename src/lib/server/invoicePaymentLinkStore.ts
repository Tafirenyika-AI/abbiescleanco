import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getInvoiceById } from "@/lib/server/invoiceStore";
import { createPaymentLink, deactivatePaymentLink } from "@/lib/server/stripe";
import { recordPayment } from "@/lib/server/paymentStore";
import { type InvoicePaymentLinkSummary } from "@/lib/invoices";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Payment links require DATABASE_URL to be configured.");
  return prisma;
}

interface LinkItem {
  invoiceId: string;
  invoiceNumber: string;
  bookingId: string;
  amount: number;
}

export interface CreatePaymentLinkResult {
  ok: boolean;
  error?: string;
  id?: string;
  url?: string;
  amount?: number;
  customerEmail?: string | null;
  customerName?: string;
}

/**
 * Builds one real Stripe Payment Link covering any number of a single customer's invoices --
 * their real outstanding balances (per deriveStatus in invoiceStore.ts, not a hand-typed amount)
 * are snapshotted into `items` now, and the webhook applies exactly that breakdown when Stripe
 * confirms payment (see /api/stripe/webhook), rather than re-deriving balances that could have
 * drifted by then (e.g. a manual payment recorded elsewhere in the meantime).
 */
export async function createPaymentLinkForInvoices(invoiceIds: string[]): Promise<CreatePaymentLinkResult> {
  if (invoiceIds.length === 0) return { ok: false, error: "Select at least one invoice." };

  const invoices = await Promise.all(invoiceIds.map((id) => getInvoiceById(id)));
  const missing = invoices.some((inv) => !inv);
  if (missing) return { ok: false, error: "One of the selected invoices couldn't be found." };
  const found = invoices.filter((inv): inv is NonNullable<typeof inv> => !!inv);

  const customerIds = new Set(found.map((inv) => inv.customerId));
  if (customerIds.size > 1) return { ok: false, error: "All selected invoices must belong to the same customer." };

  const withoutBooking = found.find((inv) => !inv.bookingId);
  if (withoutBooking) return { ok: false, error: `${withoutBooking.invoiceNumber} has no linked booking, so it can't be paid online yet.` };

  const alreadyPaid = found.find((inv) => inv.balance <= 0);
  if (alreadyPaid) return { ok: false, error: `${alreadyPaid.invoiceNumber} is already paid in full.` };

  const cancelled = found.find((inv) => inv.status === "CANCELLED");
  if (cancelled) return { ok: false, error: `${cancelled.invoiceNumber} is cancelled and can't be paid.` };

  const items: LinkItem[] = found.map((inv) => ({
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    bookingId: inv.bookingId!,
    amount: inv.balance,
  }));
  const amount = items.reduce((sum, i) => sum + i.amount, 0);
  const invoiceNumbers = items.map((i) => i.invoiceNumber);
  const description =
    invoiceNumbers.length === 1
      ? `Invoice ${invoiceNumbers[0]}, Abbie's Clean Method`
      : `${invoiceNumbers.length} invoices (${invoiceNumbers.join(", ")}), Abbie's Clean Method`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const stripeResult = await createPaymentLink({ amount, description, successUrl: `${siteUrl}/pay/success` });
  if (!stripeResult.ok) return { ok: false, error: stripeResult.error };

  await db().invoicePaymentLink.create({
    data: {
      invoiceIds,
      items: items as unknown as Prisma.InputJsonValue,
      customerId: found[0].customerId,
      status: "PENDING",
      url: stripeResult.url,
      stripePaymentLinkId: stripeResult.paymentLinkId,
    },
  });

  return { ok: true, url: stripeResult.url, amount, customerEmail: found[0].customerEmail || null, customerName: found[0].customerName };
}

/** Real payment-link history for one invoice -- shown on its own detail page as a permanent
 *  record of what was sent and whether it was ever paid, per the business's own request. */
export async function listPaymentLinksForInvoice(invoiceId: string): Promise<InvoicePaymentLinkSummary[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const links = await prisma.invoicePaymentLink.findMany({
    where: { invoiceIds: { has: invoiceId } },
    orderBy: { createdAt: "desc" },
  });
  return links.map((l) => {
    const items = l.items as unknown as LinkItem[];
    return {
      id: l.id,
      invoiceIds: l.invoiceIds,
      invoiceNumbers: items.map((i) => i.invoiceNumber),
      amount: items.reduce((sum, i) => sum + i.amount, 0),
      status: l.status,
      url: l.url,
      createdAt: l.createdAt.toISOString(),
      paidAt: l.paidAt?.toISOString() ?? null,
    };
  });
}

export async function voidPaymentLink(id: string): Promise<{ ok: boolean; error?: string }> {
  const link = await db().invoicePaymentLink.findUnique({ where: { id } });
  if (!link) return { ok: false, error: "Payment link not found" };
  if (link.status !== "PENDING") return { ok: false, error: "Only an unpaid link can be cancelled." };
  await deactivatePaymentLink(link.stripePaymentLinkId);
  await db().invoicePaymentLink.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() } });
  return { ok: true };
}

export interface PaidLinkResult {
  customerName: string;
  customerEmail: string | null;
  amount: number;
  invoiceNumbers: string[];
}

/**
 * Called by the Stripe webhook once a Checkout Session created from one of our Payment Links
 * completes. Atomic PENDING->PAID guard (an update that only succeeds if status is still PENDING)
 * instead of a plain read-then-write, because Stripe delivers webhooks at-least-once and two
 * near-simultaneous deliveries for the same session must never both record the payment twice.
 */
export async function markPaymentLinkPaid(
  stripePaymentLinkId: string,
  stripeCheckoutSessionId: string,
  stripePaymentIntentId: string | null
): Promise<PaidLinkResult | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const link = await prisma.invoicePaymentLink.findUnique({ where: { stripePaymentLinkId }, include: { customer: true } });
  if (!link) return null;

  const claimed = await prisma.invoicePaymentLink.updateMany({
    where: { id: link.id, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), stripeCheckoutSessionId },
  });
  if (claimed.count === 0) return null; // already processed by an earlier delivery of this webhook

  const items = link.items as unknown as LinkItem[];
  for (const item of items) {
    await recordPayment({
      bookingId: item.bookingId,
      amount: item.amount,
      kind: "invoice_payment",
      status: "PAID",
      method: "CARD",
      provider: "STRIPE",
      stripePaymentIntentId: stripePaymentIntentId ?? undefined,
      reference: `Paid online via invoice ${item.invoiceNumber}'s payment link`,
    });
  }

  return {
    customerName: `${link.customer.firstName} ${link.customer.lastName}`.trim(),
    customerEmail: link.customer.email ?? null,
    amount: items.reduce((sum, i) => sum + i.amount, 0),
    invoiceNumbers: items.map((i) => i.invoiceNumber),
  };
}
