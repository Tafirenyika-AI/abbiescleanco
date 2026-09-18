import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * A logged-in customer's view of their own history -- every query here is
 * scoped by customerId (taken from the verified session, never from client
 * input) so a customer can only ever see their own requests/quotes/
 * bookings/payments, never anyone else's.
 */

export interface MyRequestItem {
  id: string;
  reference: string;
  status: string;
  serviceName: string;
  estimateLabel: string;
  createdAt: string;
}

export async function getMyRequests(customerId: string): Promise<MyRequestItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const leads = await prisma.lead.findMany({
    where: { customerId, deletedAt: null },
    include: { service: true, quoteRequest: true },
    orderBy: { createdAt: "desc" },
  });
  return leads.map((l) => ({
    id: l.id,
    reference: l.reference,
    status: l.status,
    serviceName: l.service.name,
    estimateLabel: l.quoteRequest?.requiresManualQuote
      ? "Manual quote required"
      : l.quoteRequest?.estimateLow != null && l.quoteRequest?.estimateHigh != null
        ? `$${l.quoteRequest.estimateLow}–$${l.quoteRequest.estimateHigh}`
        : "—",
    createdAt: l.createdAt.toISOString(),
  }));
}

export interface MyQuoteItem {
  id: string;
  quoteNumber: string;
  status: string;
  total: number; // cents
  expiresAt: string | null;
  promoCode: string | null;
  createdAt: string;
}

export async function getMyQuotes(customerId: string): Promise<MyQuoteItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const quotes = await prisma.quote.findMany({
    where: { lead: { customerId }, deletedAt: null },
    include: { promoCode: true },
    orderBy: { createdAt: "desc" },
  });
  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    total: q.total,
    expiresAt: q.expiresAt?.toISOString() ?? null,
    promoCode: q.promoCode?.code ?? null,
    createdAt: q.createdAt.toISOString(),
  }));
}

export interface MyBookingItem {
  id: string;
  reference: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  serviceName: string;
  address: string;
  createdAt: string;
}

export async function getMyBookings(customerId: string): Promise<MyBookingItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: { customerId, deletedAt: null },
    include: { address: true, lead: { include: { service: true } } },
    orderBy: { scheduledStart: "desc" },
  });
  return bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    scheduledStart: b.scheduledStart?.toISOString() ?? null,
    scheduledEnd: b.scheduledEnd?.toISOString() ?? null,
    serviceName: b.lead?.service.name ?? "—",
    address: b.address ? `${b.address.line1}, ${b.address.city}, ${b.address.state} ${b.address.zip}` : "—",
    createdAt: b.createdAt.toISOString(),
  }));
}

export interface MyPaymentItem {
  id: string;
  amount: number; // cents
  status: string;
  kind: string;
  proofUrl: string | null;
  bookingReference: string | null;
  createdAt: string;
}

export async function getMyPayments(customerId: string): Promise<MyPaymentItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const payments = await prisma.payment.findMany({
    where: { customerId },
    include: { booking: true },
    orderBy: { createdAt: "desc" },
  });
  return payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    kind: p.kind,
    proofUrl: p.proofUrl,
    bookingReference: p.booking?.reference ?? null,
    createdAt: p.createdAt.toISOString(),
  }));
}
