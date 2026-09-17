import { prisma, isDatabaseConfigured } from "@/lib/db";
import { generateReference } from "@/lib/reference";
import { scheduleBookingConfirmationAndReminders, schedulePostServiceThankYou } from "@/lib/server/automationStore";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Bookings require DATABASE_URL to be configured.");
  return prisma;
}

export const BOOKING_STATUSES = ["REQUESTED", "CONFIRMED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;
export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

export const bookingStatusLabels: Record<BookingStatusValue, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
};

export interface BookingListItem {
  id: string;
  reference: string;
  status: BookingStatusValue;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  arrivalWindow: string | null;
  staffAssignee: string | null;
  customerName: string;
  address: string;
  serviceName: string;
}

function mapBooking(b: {
  id: string; reference: string; status: BookingStatusValue;
  scheduledStart: Date | null; scheduledEnd: Date | null; arrivalWindow: string | null; staffAssignee: string | null;
  customer: { firstName: string; lastName: string } | null;
  address: { line1: string; city: string; state: string; zip: string } | null;
  lead: { service: { name: string } } | null;
}): BookingListItem {
  return {
    id: b.id,
    reference: b.reference,
    status: b.status,
    scheduledStart: b.scheduledStart?.toISOString() ?? null,
    scheduledEnd: b.scheduledEnd?.toISOString() ?? null,
    arrivalWindow: b.arrivalWindow,
    staffAssignee: b.staffAssignee,
    customerName: b.customer ? `${b.customer.firstName} ${b.customer.lastName}`.trim() : "—",
    address: b.address ? `${b.address.line1}, ${b.address.city}, ${b.address.state} ${b.address.zip}` : "—",
    serviceName: b.lead?.service.name ?? "—",
  };
}

export async function listBookings(): Promise<BookingListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: { deletedAt: null },
    include: { customer: true, address: true, lead: { include: { service: true } } },
    orderBy: { scheduledStart: "asc" },
    take: 300,
  });
  return bookings.map(mapBooking);
}

export async function listBookingsInRange(startISO: string, endISO: string): Promise<BookingListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: { deletedAt: null, scheduledStart: { gte: new Date(startISO), lte: new Date(endISO) } },
    include: { customer: true, address: true, lead: { include: { service: true } } },
    orderBy: { scheduledStart: "asc" },
  });
  return bookings.map(mapBooking);
}

export interface BookingDetail extends BookingListItem {
  durationMinutes: number | null;
  customerPhone: string;
  customerEmail: string;
  additionalInstructions: string | null;
  quoteId: string | null;
  statusHistory: { id: string; toStatus: string; note: string | null; createdAt: string }[];
}

export async function getBookingById(id: string): Promise<BookingDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const b = await prisma.booking.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: true,
      address: true,
      lead: { include: { service: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!b) return null;
  return {
    ...mapBooking(b),
    durationMinutes: b.durationMinutes,
    customerPhone: b.customer?.phone ?? "",
    customerEmail: b.customer?.email ?? "",
    additionalInstructions: b.lead?.additionalInstructions ?? null,
    quoteId: b.quoteId,
    statusHistory: b.statusHistory.map((h) => ({ id: h.id, toStatus: h.toStatus, note: h.note, createdAt: h.createdAt.toISOString() })),
  };
}

/** Bookings whose windows overlap the given range, excluding a specific booking (used when rescheduling it). */
export async function findConflicts(scheduledStart: Date, scheduledEnd: Date, excludeBookingId?: string): Promise<BookingListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await prisma.booking.findMany({
    where: {
      deletedAt: null,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      scheduledStart: { lt: scheduledEnd },
      scheduledEnd: { gt: scheduledStart },
    },
    include: { customer: true, address: true, lead: { include: { service: true } } },
  });
  return bookings.map(mapBooking);
}

export async function createBookingFromQuote(
  quoteId: string,
  data: { scheduledStart: string; scheduledEnd: string; arrivalWindow?: string; staffAssignee?: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const quote = await db().quote.findUnique({ where: { id: quoteId }, include: { lead: true } });
  if (!quote) return { ok: false, error: "Quote not found" };
  if (!quote.lead.customerId || !quote.lead.addressId) return { ok: false, error: "This lead is missing a customer or address" };

  const booking = await db().booking.create({
    data: {
      reference: generateReference("B"),
      leadId: quote.leadId,
      quoteId: quote.id,
      customerId: quote.lead.customerId,
      addressId: quote.lead.addressId,
      status: "CONFIRMED",
      scheduledStart: new Date(data.scheduledStart),
      scheduledEnd: new Date(data.scheduledEnd),
      arrivalWindow: data.arrivalWindow,
      staffAssignee: data.staffAssignee,
      statusHistory: { create: { toStatus: "CONFIRMED", note: "Created from an accepted quote" } },
    },
  });
  await scheduleBookingConfirmationAndReminders(booking.id, new Date(data.scheduledStart));
  return { ok: true, id: booking.id };
}

export async function updateBookingStatus(id: string, status: BookingStatusValue, adminUserId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().booking.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Booking not found" };

  await db().booking.update({ where: { id }, data: { status } });
  await db().bookingStatusHistory.create({
    data: { bookingId: id, fromStatus: existing.status, toStatus: status, note, changedBy: adminUserId },
  });
  await db().auditLog.create({
    data: { adminUserId, action: "booking.status_changed", entityType: "booking", entityId: id, before: { status: existing.status }, after: { status } },
  });

  if (status === "CONFIRMED" && existing.status !== "CONFIRMED" && existing.scheduledStart) {
    await scheduleBookingConfirmationAndReminders(id, existing.scheduledStart);
  }
  if (status === "COMPLETED" && existing.status !== "COMPLETED") {
    await schedulePostServiceThankYou(id);
  }

  return { ok: true };
}

export async function rescheduleBooking(
  id: string,
  data: { scheduledStart: string; scheduledEnd: string; arrivalWindow?: string },
  adminUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().booking.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Booking not found" };

  await db().booking.update({
    where: { id },
    data: { scheduledStart: new Date(data.scheduledStart), scheduledEnd: new Date(data.scheduledEnd), arrivalWindow: data.arrivalWindow, status: "RESCHEDULED" },
  });
  await db().bookingStatusHistory.create({
    data: { bookingId: id, fromStatus: existing.status, toStatus: "RESCHEDULED", note: `Moved to ${data.scheduledStart}`, changedBy: adminUserId },
  });
  return { ok: true };
}

export async function assignStaff(id: string, staffAssignee: string): Promise<void> {
  await db().booking.update({ where: { id }, data: { staffAssignee } });
}

export async function deleteBooking(id: string): Promise<boolean> {
  const existing = await db().booking.findUnique({ where: { id } });
  if (!existing) return false;
  await db().booking.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
}

export interface SelfServiceBookingResult {
  id: string;
  reference: string;
  customerEmail: string;
  customerName: string;
  serviceName: string;
}

/**
 * A customer books themselves into an open slot, skipping the "wait for an admin to build a
 * quote" step. Lands as REQUESTED (not CONFIRMED) -- the business still reviews and confirms
 * it, same as every other booking, just without making the customer wait to pick a time.
 */
export async function createSelfServiceBooking(
  leadId: string,
  data: { addressLine1: string; addressLine2?: string; scheduledStart: string; scheduledEnd: string }
): Promise<{ ok: true } & SelfServiceBookingResult | { ok: false; error: string }> {
  const lead = await db().lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { customer: true, address: true, service: true, quoteRequest: true, bookings: true },
  });
  if (!lead) return { ok: false, error: "Request not found" };
  if (!lead.customerId || !lead.addressId || !lead.customer) return { ok: false, error: "This request is missing contact details" };
  if (lead.quoteRequest?.requiresManualQuote) return { ok: false, error: "This service needs a manual quote — we'll be in touch to confirm pricing first" };
  if (lead.bookings.some((b) => b.status !== "CANCELLED")) return { ok: false, error: "This request already has a booking" };

  const start = new Date(data.scheduledStart);
  const end = new Date(data.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid time slot" };
  }
  const conflicts = await findConflicts(start, end);
  if (conflicts.length > 0) return { ok: false, error: "That time was just booked — please pick another" };

  await db().address.update({
    where: { id: lead.addressId },
    data: { line1: data.addressLine1, line2: data.addressLine2 || null },
  });

  const estimateLow = lead.quoteRequest?.estimateLow ?? 0;
  const estimateHigh = lead.quoteRequest?.estimateHigh ?? 0;
  const subtotalCents = Math.round(((estimateLow + estimateHigh) / 2) * 100);

  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId: lead.id,
      status: "ACCEPTED",
      subtotal: subtotalCents,
      total: subtotalCents,
      notes: "Auto-generated from a self-service booking request.",
      items: { create: [{ label: lead.service.name, quantity: 1, unitPrice: subtotalCents, total: subtotalCents }] },
    },
  });

  const booking = await db().booking.create({
    data: {
      reference: generateReference("B"),
      leadId: lead.id,
      quoteId: quote.id,
      customerId: lead.customerId,
      addressId: lead.addressId,
      status: "REQUESTED",
      scheduledStart: start,
      scheduledEnd: end,
      statusHistory: { create: { toStatus: "REQUESTED", note: "Self-service booking request" } },
    },
  });

  return {
    ok: true,
    id: booking.id,
    reference: booking.reference,
    customerEmail: lead.customer.email,
    customerName: `${lead.customer.firstName} ${lead.customer.lastName}`.trim(),
    serviceName: lead.service.name,
  };
}
