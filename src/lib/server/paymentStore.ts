import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Payments require DATABASE_URL to be configured.");
  return prisma;
}

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export interface PaymentListItem {
  id: string;
  status: PaymentStatusValue;
  amount: number; // cents
  kind: string;
  createdAt: string;
  customerName: string;
  bookingReference: string | null;
  proofUrl: string | null;
  method: string | null;
  reference: string | null;
  refundAmount: number;
  tipAmount: number;
}

export async function listPayments(): Promise<PaymentListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const payments = await prisma.payment.findMany({
    include: { customer: true, booking: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return payments.map((p) => ({
    id: p.id,
    status: p.status,
    amount: p.amount,
    kind: p.kind,
    createdAt: p.createdAt.toISOString(),
    customerName: p.customer ? `${p.customer.firstName} ${p.customer.lastName}`.trim() : "—",
    bookingReference: p.booking?.reference ?? null,
    proofUrl: p.proofUrl,
    method: p.method,
    reference: p.reference,
    refundAmount: p.refundAmount,
    tipAmount: p.tipAmount,
  }));
}

export interface RecordablePayment {
  bookingId: string;
  reference: string;
  customerName: string;
}

/** Bookings that still have a balance -- stays listed after a deposit so the remainder (possibly by a different method) can be recorded too. */
export async function listBookingsAwaitingPayment(): Promise<RecordablePayment[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: { deletedAt: null, status: { notIn: ["CANCELLED"] } },
    include: { customer: true, payments: true, quote: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return bookings
    .filter((b) => {
      const paid = b.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
      return b.quote ? paid < b.quote.total : paid === 0;
    })
    .map((b) => ({ bookingId: b.id, reference: b.reference, customerName: b.customer ? `${b.customer.firstName} ${b.customer.lastName}`.trim() : "—" }));
}

export async function recordPayment(data: { bookingId: string; amount: number; kind: string; status: PaymentStatusValue; proofUrl?: string; method?: string; reference?: string; tipAmount?: number }): Promise<{ ok: boolean; error?: string }> {
  const booking = await db().booking.findUnique({ where: { id: data.bookingId } });
  if (!booking) return { ok: false, error: "Booking not found" };

  await db().payment.create({
    data: {
      customerId: booking.customerId,
      bookingId: booking.id,
      amount: data.amount,
      kind: data.kind,
      status: data.status,
      proofUrl: data.proofUrl,
      method: data.method,
      reference: data.reference || null,
      provider: "MANUAL",
      tipAmount: data.tipAmount ?? 0,
    },
  });
  return { ok: true };
}

/**
 * Refunds require a real admin's approval to record -- matches the finance spec's "require admin
 * approval before: refund" rule. This never talks to Stripe itself (issuing the real refund on the
 * processor is a separate, deliberate manual step outside this app for now); it records that a
 * refund happened, against a real PAID payment, so Finance's numbers reflect reality.
 */
export async function recordRefund(paymentId: string, amount: number, reason: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().payment.findUnique({ where: { id: paymentId } });
  if (!existing) return { ok: false, error: "Payment not found" };
  if (existing.status !== "PAID") return { ok: false, error: "Only a paid payment can be refunded." };
  const newRefundTotal = existing.refundAmount + amount;
  if (amount <= 0) return { ok: false, error: "Enter a refund amount greater than $0." };
  if (newRefundTotal > existing.amount) return { ok: false, error: "Refund amount can't exceed what was actually paid." };

  await db().payment.update({
    where: { id: paymentId },
    data: {
      refundAmount: newRefundTotal,
      refundedAt: new Date(),
      refundReason: reason.trim() || null,
      status: newRefundTotal >= existing.amount ? "REFUNDED" : existing.status,
    },
  });
  await db().auditLog.create({
    data: {
      adminUserId,
      action: "payment.refunded",
      entityType: "Payment",
      entityId: paymentId,
      after: { refundAmount: newRefundTotal, reason: reason.trim() || null },
    },
  });
  return { ok: true };
}

export async function updatePaymentStatus(id: string, status: PaymentStatusValue): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().payment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Payment not found" };
  await db().payment.update({ where: { id }, data: { status } });
  return { ok: true };
}

export async function setPaymentProof(id: string, proofUrl: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().payment.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Payment not found" };
  await db().payment.update({ where: { id }, data: { proofUrl } });
  return { ok: true };
}

/** Created the moment an admin generates a Stripe Checkout link — the webhook flips it to PAID/FAILED once Stripe confirms. */
export async function createPendingStripePayment(data: {
  bookingId: string;
  amount: number;
  kind: string;
  stripePaymentIntentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const booking = await db().booking.findUnique({ where: { id: data.bookingId } });
  if (!booking) return { ok: false, error: "Booking not found" };

  await db().payment.create({
    data: {
      customerId: booking.customerId,
      bookingId: booking.id,
      amount: data.amount,
      kind: data.kind,
      status: "PENDING",
      stripePaymentIntentId: data.stripePaymentIntentId,
      method: "CARD",
    },
  });
  return { ok: true };
}

export interface StripePaymentUpdateResult {
  id: string;
  bookingId: string | null;
  amount: number;
  customerName: string;
  customerEmail: string | null;
}

/** Used by the Stripe webhook — looks the payment up by the PaymentIntent id set when the Checkout link was created. */
export async function markPaymentByIntentId(paymentIntentId: string, status: PaymentStatusValue, proofUrl?: string | null): Promise<StripePaymentUpdateResult | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const existing = await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId }, include: { customer: true } });
  if (!existing) return null;
  // Idempotency: Stripe delivers webhooks at-least-once, so the same event can arrive twice. If
  // this payment already has the status this call is trying to set, treat it as a no-op retry --
  // returning null skips the caller's notify/receipt-email side effects, which are NOT idempotent
  // (a genuine duplicate admin notification / duplicate receipt email to the customer otherwise).
  if (existing.status === status) return null;

  await prisma.payment.update({ where: { id: existing.id }, data: { status, provider: "STRIPE", ...(proofUrl ? { proofUrl } : {}) } });
  return {
    id: existing.id,
    bookingId: existing.bookingId,
    amount: existing.amount,
    customerName: existing.customer ? `${existing.customer.firstName} ${existing.customer.lastName}`.trim() : "",
    customerEmail: existing.customer?.email ?? null,
  };
}
