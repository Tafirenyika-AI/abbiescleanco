import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Customers require DATABASE_URL to be configured.");
  return prisma;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  primaryAddress: string | null;
  totalBookings: number;
  lastCleaning: string | null;
  nextCleaning: string | null;
  lifetimeValue: number;
  outstandingBalance: number;
  status: "active" | "lead" | "new";
}

export async function createCustomer(data: { firstName: string; lastName: string; email: string; phone: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const existing = await db().customer.findFirst({ where: { email: data.email.toLowerCase(), deletedAt: null } });
  if (existing) return { ok: false, error: "A customer with that email already exists" };

  const customer = await db().customer.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      communicationPreference: { create: { smsConsent: false, emailConsent: true } },
    },
  });
  return { ok: true, id: customer.id };
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string;
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
    include: {
      addresses: { take: 1, orderBy: { createdAt: "asc" } },
      bookings: { select: { status: true, scheduledStart: true } },
      payments: { select: { status: true, amount: true } },
      leads: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = Date.now();
  return customers.map((c) => {
    const completed = c.bookings.filter((b) => b.status === "COMPLETED" && b.scheduledStart);
    const upcoming = c.bookings.filter((b) => b.scheduledStart && new Date(b.scheduledStart).getTime() > now);
    const lastCleaning = completed.sort((a, b) => (b.scheduledStart! > a.scheduledStart! ? 1 : -1))[0]?.scheduledStart ?? null;
    const nextCleaning = upcoming.sort((a, b) => (a.scheduledStart! > b.scheduledStart! ? 1 : -1))[0]?.scheduledStart ?? null;
    const lifetimeValue = c.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
    const outstandingBalance = c.payments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amount, 0);
    const primary = c.addresses[0];

    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone,
      primaryAddress: primary ? `${primary.city}, ${primary.state} ${primary.zip}` : null,
      totalBookings: c.bookings.length,
      lastCleaning: lastCleaning ? lastCleaning.toISOString() : null,
      nextCleaning: nextCleaning ? nextCleaning.toISOString() : null,
      lifetimeValue,
      outstandingBalance,
      status: c.bookings.length > 0 ? "active" : c.leads.length > 0 ? "lead" : "new",
    };
  });
}

export interface CustomerDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
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

export async function updateCustomerNotes(
  id: string,
  data: Partial<{ notes: string; petsNote: string; accessInstructions: string }>
) {
  await db().customer.update({ where: { id }, data });
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
