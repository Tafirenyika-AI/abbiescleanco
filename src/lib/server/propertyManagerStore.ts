import { prisma, isDatabaseConfigured } from "@/lib/db";
import { createAdminBooking } from "@/lib/server/bookingStore";

/**
 * Property managers module: a real admin-facing view for customers who manage multiple
 * properties (not a separate login/portal -- they're still ordinary Customer records, just
 * flagged). Reuses the existing Customer/Address/Booking data model and the existing
 * createAdminBooking() quick-booking flow (extended to accept an existing addressId) rather than
 * building a parallel system -- a "turnover" here is just a normal booking against one of a
 * flagged customer's known properties.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Property managers requires DATABASE_URL to be configured.");
  return prisma;
}

export interface PropertyManagerListItem {
  customerId: string;
  name: string;
  email: string | null;
  phone: string;
  propertyCount: number;
  upcomingCount: number;
  totalBookings: number;
}

export async function listPropertyManagers(): Promise<PropertyManagerListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const customers = await db().customer.findMany({
    where: { isPropertyManager: true, deletedAt: null },
    include: {
      addresses: { where: { deletedAt: null }, select: { id: true } },
      bookings: { select: { status: true, scheduledStart: true } },
    },
    orderBy: { firstName: "asc" },
  });
  const now = Date.now();
  return customers.map((c) => ({
    customerId: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    phone: c.phone,
    propertyCount: c.addresses.length,
    upcomingCount: c.bookings.filter((b) => b.scheduledStart && new Date(b.scheduledStart).getTime() > now && b.status !== "CANCELLED").length,
    totalBookings: c.bookings.length,
  }));
}

export interface PropertyItem {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  bookingCount: number;
}

export interface PropertyManagerBooking {
  id: string;
  reference: string;
  addressId: string;
  status: string;
  scheduledStart: string | null;
  amount: number | null;
}

export interface PropertyManagerDetail {
  customerId: string;
  name: string;
  email: string | null;
  phone: string;
  properties: PropertyItem[];
  bookings: PropertyManagerBooking[];
}

export async function getPropertyManagerDetail(customerId: string): Promise<PropertyManagerDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const c = await db().customer.findFirst({
    where: { id: customerId, isPropertyManager: true, deletedAt: null },
    include: {
      addresses: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      bookings: { orderBy: { createdAt: "desc" }, take: 100, include: { quote: { select: { total: true } } } },
    },
  });
  if (!c) return null;

  const bookingCountByAddress = new Map<string, number>();
  for (const b of c.bookings) bookingCountByAddress.set(b.addressId, (bookingCountByAddress.get(b.addressId) ?? 0) + 1);

  return {
    customerId: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    phone: c.phone,
    properties: c.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      zip: a.zip,
      propertyType: a.propertyType,
      bookingCount: bookingCountByAddress.get(a.id) ?? 0,
    })),
    bookings: c.bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      addressId: b.addressId,
      status: b.status,
      scheduledStart: b.scheduledStart ? b.scheduledStart.toISOString() : null,
      amount: b.quote?.total ?? null,
    })),
  };
}

export async function setPropertyManagerFlag(customerId: string, flag: boolean, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const customer = await db().customer.findFirst({ where: { id: customerId, deletedAt: null } });
  if (!customer) return { ok: false, error: "Customer not found" };
  await db().customer.update({ where: { id: customerId }, data: { isPropertyManager: flag } });
  await db().auditLog.create({
    data: { adminUserId, action: flag ? "customer.marked_property_manager" : "customer.unmarked_property_manager", entityType: "Customer", entityId: customerId },
  });
  return { ok: true };
}

export async function addProperty(
  customerId: string,
  input: { label: string | null; line1: string; line2: string | null; city: string; state: string; zip: string; propertyType: string },
  adminUserId: string
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const customer = await db().customer.findFirst({ where: { id: customerId, isPropertyManager: true, deletedAt: null } });
  if (!customer) return { ok: false, error: "Property manager not found" };
  const address = await db().address.create({
    data: { customerId, label: input.label, line1: input.line1, line2: input.line2, city: input.city, state: input.state, zip: input.zip, propertyType: input.propertyType },
  });
  await db().auditLog.create({ data: { adminUserId, action: "property_manager.property_added", entityType: "Address", entityId: address.id, after: { customerId, label: input.label } } });
  return { ok: true, id: address.id };
}

export async function scheduleTurnover(input: {
  customerId: string;
  addressId: string;
  serviceSlug: string;
  serviceName: string;
  amount: number;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const pm = await db().customer.findFirst({ where: { id: input.customerId, isPropertyManager: true, deletedAt: null } });
  if (!pm) return { ok: false, error: "Property manager not found" };
  return createAdminBooking({
    customerId: input.customerId,
    addressId: input.addressId,
    serviceSlug: input.serviceSlug,
    serviceName: input.serviceName,
    amount: input.amount,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
  });
}
