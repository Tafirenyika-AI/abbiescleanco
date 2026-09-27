import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Customers require DATABASE_URL to be configured.");
  return prisma;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  primaryAddress: string | null;
  totalBookings: number;
  lastCleaning: string | null;
  nextCleaning: string | null;
  lifetimeValue: number;
  outstandingBalance: number;
  status: "active" | "lead" | "new";
}

/** email is optional -- a real client (not tech-savvy) may genuinely have none; phone is the one
 *  required contact method. The duplicate-email check only applies when an email was given, so
 *  two different no-email customers never collide with each other. */
export async function createCustomer(data: { firstName: string; lastName: string; email?: string | null; phone: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const email = data.email?.trim() ? data.email.trim().toLowerCase() : null;
  if (email) {
    const existing = await db().customer.findFirst({ where: { email, deletedAt: null } });
    if (existing) return { ok: false, error: "A customer with that email already exists" };
  }

  const customer = await db().customer.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email,
      phone: data.phone,
      communicationPreference: { create: { smsConsent: false, emailConsent: true } },
    },
  });
  return { ok: true, id: customer.id };
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
  phone: string;
}

/** Lightweight list for search/select UIs (e.g. picking a customer for a new booking) -- not the full aggregated summary. */
export async function listCustomerOptions(): Promise<CustomerOption[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    orderBy: { firstName: "asc" },
  });
  return customers.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone }));
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  if (!isDatabaseConfigured || !prisma) return [];

  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    include: { addresses: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ids = customers.map((c) => c.id);
  const now = new Date();

  // Aggregated per-customer via groupBy instead of pulling every booking/payment/lead row into
  // memory -- a customer with hundreds of jobs (e.g. a property manager) no longer drags the
  // whole /admin/customers page down with it.
  const [bookingCounts, lastCleanings, nextCleanings, leadCounts, paidSums, pendingSums] = await Promise.all([
    prisma.booking.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "COMPLETED", scheduledStart: { not: null } }, _max: { scheduledStart: true } }),
    prisma.booking.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, scheduledStart: { gt: now } }, _min: { scheduledStart: true } }),
    prisma.lead.groupBy({ by: ["customerId"], where: { customerId: { in: ids } }, _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "PENDING" }, _sum: { amount: true } }),
  ]);
  const totalBookingsById = new Map(bookingCounts.map((b) => [b.customerId, b._count._all]));
  const lastCleaningById = new Map(lastCleanings.map((b) => [b.customerId, b._max.scheduledStart]));
  const nextCleaningById = new Map(nextCleanings.map((b) => [b.customerId, b._min.scheduledStart]));
  const leadCountById = new Map(leadCounts.map((l) => [l.customerId ?? "", l._count._all]));
  const lifetimeValueById = new Map(paidSums.map((p) => [p.customerId, p._sum.amount ?? 0]));
  const outstandingBalanceById = new Map(pendingSums.map((p) => [p.customerId, p._sum.amount ?? 0]));

  return customers.map((c) => {
    const primary = c.addresses[0];
    const totalBookings = totalBookingsById.get(c.id) ?? 0;
    const lastCleaning = lastCleaningById.get(c.id) ?? null;
    const nextCleaning = nextCleaningById.get(c.id) ?? null;

    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      primaryAddress: primary ? `${primary.city}, ${primary.state} ${primary.zip}` : null,
      totalBookings,
      lastCleaning: lastCleaning ? lastCleaning.toISOString() : null,
      nextCleaning: nextCleaning ? nextCleaning.toISOString() : null,
      lifetimeValue: lifetimeValueById.get(c.id) ?? 0,
      outstandingBalance: outstandingBalanceById.get(c.id) ?? 0,
      status: totalBookings > 0 ? "active" : (leadCountById.get(c.id) ?? 0) > 0 ? "lead" : "new",
    };
  });
}

export interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  notes: string | null;
  petsNote: string | null;
  accessInstructions: string | null;
  createdAt: string;
  addresses: { id: string; line1: string; line2: string | null; city: string; state: string; zip: string; propertyType: string }[];
  bookings: { id: string; reference: string; status: string; scheduledStart: string | null }[];
  payments: { id: string; status: string; amount: number; kind: string; createdAt: string }[];
  leads: { id: string; reference: string; status: string; createdAt: string }[];
  communicationPreference: { smsConsent: boolean; emailConsent: boolean; marketingConsent: boolean } | null;
}

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;

  const c = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      addresses: { orderBy: { createdAt: "asc" } },
      bookings: { orderBy: { createdAt: "desc" }, take: 50 },
      payments: { orderBy: { createdAt: "desc" }, take: 50 },
      leads: { orderBy: { createdAt: "desc" }, take: 50 },
      communicationPreference: true,
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
    petsNote: c.petsNote,
    accessInstructions: c.accessInstructions,
    createdAt: c.createdAt.toISOString(),
    addresses: c.addresses.map((a) => ({ id: a.id, line1: a.line1, line2: a.line2, city: a.city, state: a.state, zip: a.zip, propertyType: a.propertyType })),
    bookings: c.bookings.map((b) => ({ id: b.id, reference: b.reference, status: b.status, scheduledStart: b.scheduledStart?.toISOString() ?? null })),
    payments: c.payments.map((p) => ({ id: p.id, status: p.status, amount: p.amount, kind: p.kind, createdAt: p.createdAt.toISOString() })),
    leads: c.leads.map((l) => ({ id: l.id, reference: l.reference, status: l.status, createdAt: l.createdAt.toISOString() })),
    communicationPreference: c.communicationPreference
      ? {
          smsConsent: c.communicationPreference.smsConsent,
          emailConsent: c.communicationPreference.emailConsent,
          marketingConsent: c.communicationPreference.marketingConsent,
        }
      : null,
  };
}

/** Covers both the Notes & preferences tab AND the Overview tab's editable contact fields --
 *  the only way to add an email after creating a customer without one (see createCustomer). */
export async function updateCustomer(
  id: string,
  data: Partial<{ notes: string; petsNote: string; accessInstructions: string; email: string | null; phone: string }>
): Promise<{ ok: boolean; error?: string }> {
  const patch: typeof data = { ...data };
  if ("email" in patch) {
    const email = patch.email?.trim() ? patch.email.trim().toLowerCase() : null;
    if (email) {
      const existing = await db().customer.findFirst({ where: { email, deletedAt: null, NOT: { id } } });
      if (existing) return { ok: false, error: "Another customer already has that email" };
    }
    patch.email = email;
  }
  await db().customer.update({ where: { id }, data: patch });
  return { ok: true };
}

export async function deleteCustomer(id: string, adminUserId: string): Promise<boolean> {
  const before = await db().customer.findUnique({ where: { id } });
  if (!before || before.deletedAt) return false;
  await db().customer.update({ where: { id }, data: { deletedAt: new Date() } });
  await db().auditLog.create({
    data: { adminUserId, action: "customer.deleted", entityType: "customer", entityId: id, before: { email: before.email } },
  });
  return true;
}
