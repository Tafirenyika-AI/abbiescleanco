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
  }));
}

export interface RecordablePayment {
  bookingId: string;
  reference: string;
  customerName: string;
}

/** Confirmed bookings without a recorded payment yet — the pool of things "Record payment" can attach to. */
export async function listBookingsAwaitingPayment(): Promise<RecordablePayment[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: { deletedAt: null, status: { notIn: ["CANCELLED"] } },
    include: { customer: true, payments: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return bookings
    .filter((b) => !b.payments.some((p) => p.status === "PAID"))
    .map((b) => ({ bookingId: b.id, reference: b.reference, customerName: b.customer ? `${b.customer.firstName} ${b.customer.lastName}`.trim() : "—" }));
}

export async function recordPayment(data: { bookingId: string; amount: number; kind: string; status: PaymentStatusValue }): Promise<{ ok: boolean; error?: string }> {
  const booking = await db().booking.findUnique({ where: { id: data.bookingId } });
  if (!booking) return { ok: false, error: "Booking not found" };

  await db().payment.create({
    data: {
      customerId: booking.customerId,
      bookingId: booking.id,
      amount: data.amount,
      kind: data.kind,
      status: data.status,
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
