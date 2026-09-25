import { prisma, isDatabaseConfigured } from "@/lib/db";
import { Prisma, type PrismaClient } from "@prisma/client";
import { generateReference } from "@/lib/reference";
import { scheduleBookingConfirmationAndReminders, schedulePostServiceThankYou, notifyOnTheWay } from "@/lib/server/automationStore";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Bookings require DATABASE_URL to be configured.");
  return prisma;
}

type QueryClient = PrismaClient | Prisma.TransactionClient;

/** Thrown inside {@link withSlotLock} when the authoritative re-check finds the slot is no longer free. */
export class SlotConflictError extends Error {}

/**
 * Two concurrent requests can both pass a plain `findConflicts` check before either has written
 * its booking (classic check-then-act race) -- a customer double-clicking, or two different
 * customers, could otherwise both land a booking in the same slot. This re-runs the conflict
 * check and the write inside one Postgres SERIALIZABLE transaction, so Postgres itself detects
 * the write-write/write-read conflict and aborts the loser with a serialization failure (error
 * 40001 / Prisma code P2034) instead of letting both commits succeed -- retried a couple of
 * times since a serialization failure is expected to happen occasionally under real contention
 * and is meant to be retried, not treated as a hard error.
 */
export async function withSlotLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const client = db();
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await client.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      lastErr = err;
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2034" || (typeof err.meta?.code === "string" && err.meta.code === "40001"));
      if (!isSerializationFailure) throw err;
    }
  }
  throw lastErr;
}

export const BOOKING_STATUSES = ["REQUESTED", "CONFIRMED", "SCHEDULED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;
export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

export const bookingStatusLabels: Record<BookingStatusValue, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  ON_THE_WAY: "On the way",
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
  city: string | null;
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
    city: b.address?.city ?? null,
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

/**
 * Bookings whose windows overlap the given range, excluding a specific booking (used when
 * rescheduling it). Pass `client` (a transaction handle from {@link withSlotLock}) when this
 * check must be authoritative rather than a best-effort early check -- see that function's doc.
 */
export async function findConflicts(scheduledStart: Date, scheduledEnd: Date, excludeBookingId?: string, client?: QueryClient): Promise<BookingListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const bookings = await (client ?? prisma).booking.findMany({
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

/** A job can't be started earlier than this many minutes before its scheduled start... */
export const EARLY_START_GRACE_MINUTES = 20;

export type UpdateStatusResult = { ok: true } | { ok: false; error: string; code?: "TOO_EARLY"; earliest?: string };

/**
 * ...unless an admin explicitly approves it with a note (recorded in the booking's
 * status history and the audit log), e.g. the customer asked for an earlier start.
 */
export async function updateBookingStatus(id: string, status: BookingStatusValue, adminUserId: string, note?: string): Promise<UpdateStatusResult> {
  const existing = await db().booking.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Booking not found" };

  let approvedEarly = false;
  if (status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS" && existing.scheduledStart) {
    const earliest = new Date(existing.scheduledStart.getTime() - EARLY_START_GRACE_MINUTES * 60 * 1000);
    if (Date.now() < earliest.getTime()) {
      if (!note?.trim()) {
        return {
          ok: false,
          code: "TOO_EARLY",
          earliest: earliest.toISOString(),
          error: `This job can't be started until ${EARLY_START_GRACE_MINUTES} minutes before its scheduled start. Add an approval note to start early, or reschedule it.`,
        };
      }
      approvedEarly = true;
    }
  }
  const historyNote = approvedEarly ? `Started early, approved: ${note!.trim()}` : note;

  await db().booking.update({ where: { id }, data: { status } });
  await db().bookingStatusHistory.create({
    data: { bookingId: id, fromStatus: existing.status, toStatus: status, note: historyNote, changedBy: adminUserId },
  });
  await db().auditLog.create({
    data: {
      adminUserId, action: approvedEarly ? "booking.started_early" : "booking.status_changed", entityType: "booking", entityId: id,
      before: { status: existing.status }, after: approvedEarly ? { status, approvalNote: note!.trim() } : { status },
    },
  });

  if (status === "CONFIRMED" && existing.status !== "CONFIRMED" && existing.scheduledStart) {
    await scheduleBookingConfirmationAndReminders(id, existing.scheduledStart);
  }
  if (status === "ON_THE_WAY" && existing.status !== "ON_THE_WAY") {
    await notifyOnTheWay(id);
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
  if (lead.quoteRequest?.requiresManualQuote) return { ok: false, error: "This service needs a manual quote, we'll be in touch to confirm pricing first" };
  if (lead.bookings.some((b) => b.status !== "CANCELLED")) return { ok: false, error: "This request already has a booking" };

  const start = new Date(data.scheduledStart);
  const end = new Date(data.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid time slot" };
  }
  const conflicts = await findConflicts(start, end);
  if (conflicts.length > 0) return { ok: false, error: "That time was just booked, please pick another" };

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

  let booking: { id: string; reference: string };
  try {
    booking = await withSlotLock(async (tx) => {
      if ((await findConflicts(start, end, undefined, tx)).length > 0) throw new SlotConflictError();
      return tx.booking.create({
        data: {
          reference: generateReference("B"),
          leadId: lead.id,
          quoteId: quote.id,
          customerId: lead.customerId as string,
          addressId: lead.addressId as string,
          status: "REQUESTED",
          scheduledStart: start,
          scheduledEnd: end,
          statusHistory: { create: { toStatus: "REQUESTED", note: "Self-service booking request" } },
        },
      });
    });
  } catch (err) {
    if (err instanceof SlotConflictError) return { ok: false, error: "That time was just booked, please pick another" };
    throw err;
  }

  return {
    ok: true,
    id: booking.id,
    reference: booking.reference,
    customerEmail: lead.customer.email ?? "",
    customerName: `${lead.customer.firstName} ${lead.customer.lastName}`.trim(),
    serviceName: lead.service.name,
  };
}

/**
 * Admin "Schedule booking" shortcut from a Lead's detail panel -- skips manually building a
 * Quote first for the common case where the admin just wants to lock in a price and a time.
 * Unlike self-service booking, this is admin-initiated so it lands straight at CONFIRMED, the
 * price is whatever the admin enters (not auto-derived from the estimate), and a lead flagged
 * "requires manual quote" is still allowed through -- that flag exists to make sure a human
 * reviews pricing before anything is promised, and a human (the admin) is doing exactly that.
 */
export async function scheduleBookingFromLead(
  leadId: string,
  data: { addressLine1: string; addressLine2?: string; amount: number; scheduledStart: string; scheduledEnd: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const lead = await db().lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { customer: true, address: true, service: true, bookings: true },
  });
  if (!lead) return { ok: false, error: "Lead not found" };
  if (!lead.customerId || !lead.addressId || !lead.customer) return { ok: false, error: "This lead is missing a customer or address" };
  if (lead.bookings.some((b) => b.status !== "CANCELLED")) return { ok: false, error: "This lead already has a booking" };

  const start = new Date(data.scheduledStart);
  const end = new Date(data.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid date/time" };
  }
  const conflicts = await findConflicts(start, end);
  if (conflicts.length > 0) return { ok: false, error: "That time conflicts with an existing booking" };

  await db().address.update({
    where: { id: lead.addressId },
    data: { line1: data.addressLine1, line2: data.addressLine2 || null },
  });

  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId: lead.id,
      status: "ACCEPTED",
      subtotal: data.amount,
      total: data.amount,
      notes: "Created directly from the lead via Schedule booking (admin quick-create).",
      items: { create: [{ label: lead.service.name, quantity: 1, unitPrice: data.amount, total: data.amount }] },
    },
  });

  let booking: { id: string };
  try {
    booking = await withSlotLock(async (tx) => {
      if ((await findConflicts(start, end, undefined, tx)).length > 0) throw new SlotConflictError();
      return tx.booking.create({
        data: {
          reference: generateReference("B"),
          leadId: lead.id,
          quoteId: quote.id,
          customerId: lead.customerId as string,
          addressId: lead.addressId as string,
          status: "CONFIRMED",
          scheduledStart: start,
          scheduledEnd: end,
          statusHistory: { create: { toStatus: "CONFIRMED", note: "Scheduled directly from the lead by admin" } },
        },
      });
    });
  } catch (err) {
    if (err instanceof SlotConflictError) return { ok: false, error: "That time conflicts with an existing booking" };
    throw err;
  }

  await scheduleBookingConfirmationAndReminders(booking.id, start);

  return { ok: true, id: booking.id };
}

/**
 * Admin "New Booking" quick-create -- for an existing customer who's calling to book again,
 * where a fresh estimate/quote review isn't needed. Creates a minimal Lead+Quote behind the
 * scenes (both required by the data model) alongside the Booking, all in one step, landing
 * straight at CONFIRMED since the admin is deliberately booking it, not just requesting a slot.
 */
export async function createAdminBooking(data: {
  customerId: string;
  serviceSlug: string;
  serviceName: string;
  amount: number; // cents
  // Either reuse an existing property (e.g. a property manager's known unit)...
  addressId?: string;
  // ...or create a new one, matching the previous behavior exactly when addressId is omitted.
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  addressLabel?: string; // optional nickname for a newly-created property, e.g. "Unit 4B"
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const customer = await db().customer.findUnique({ where: { id: data.customerId } });
  if (!customer) return { ok: false, error: "Customer not found" };

  const start = new Date(data.scheduledStart);
  const end = new Date(data.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, error: "Invalid date/time" };
  }
  const conflicts = await findConflicts(start, end);
  if (conflicts.length > 0) return { ok: false, error: "That time conflicts with an existing booking" };

  const service = await db().serviceCatalogItem.upsert({
    where: { slug: data.serviceSlug },
    update: {},
    create: { slug: data.serviceSlug, name: data.serviceName, description: "" },
  });

  let address: { id: string };
  if (data.addressId) {
    const existing = await db().address.findFirst({ where: { id: data.addressId, customerId: customer.id, deletedAt: null } });
    if (!existing) return { ok: false, error: "Property not found for this customer" };
    address = existing;
  } else {
    if (!data.addressLine1 || !data.zip) return { ok: false, error: "Address is required" };
    address = await db().address.create({
      data: {
        customerId: customer.id,
        line1: data.addressLine1,
        line2: data.addressLine2 || null,
        city: data.city || "Spokane Valley",
        state: data.state || "WA",
        zip: data.zip,
        propertyType: "house",
        label: data.addressLabel || null,
      },
    });
  }

  const lead = await db().lead.create({
    data: {
      reference: generateReference(),
      customerId: customer.id,
      addressId: address.id,
      serviceId: service.id,
      source: "admin",
      status: "CONFIRMED",
      preferredContactMethod: "PHONE",
    },
  });

  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId: lead.id,
      status: "ACCEPTED",
      subtotal: data.amount,
      total: data.amount,
      notes: "Created directly from New Booking (admin quick-create).",
      items: { create: [{ label: data.serviceName, quantity: 1, unitPrice: data.amount, total: data.amount }] },
    },
  });

  let booking: { id: string };
  try {
    booking = await withSlotLock(async (tx) => {
      if ((await findConflicts(start, end, undefined, tx)).length > 0) throw new SlotConflictError();
      return tx.booking.create({
        data: {
          reference: generateReference("B"),
          leadId: lead.id,
          quoteId: quote.id,
          customerId: customer.id,
          addressId: address.id,
          status: "CONFIRMED",
          scheduledStart: start,
          scheduledEnd: end,
          statusHistory: { create: { toStatus: "CONFIRMED", note: "Created directly by admin" } },
        },
      });
    });
  } catch (err) {
    if (err instanceof SlotConflictError) return { ok: false, error: "That time conflicts with an existing booking" };
    throw err;
  }

  await scheduleBookingConfirmationAndReminders(booking.id, start);

  return { ok: true, id: booking.id };
}
