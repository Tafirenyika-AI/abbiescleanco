import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { generateReference } from "@/lib/reference";
import type { QuoteRequestInput } from "@/lib/validation/quote";
import type { EstimateResult } from "@/lib/pricing";
import type { LeadStatusValue, StoredLead, LeadActivityEntry } from "@/lib/leads";

export { LEAD_STATUSES, leadStatusLabels, type LeadStatusValue, type StoredLead, type LeadActivityEntry } from "@/lib/leads";

const MOCK_DATA_DIR = path.join(process.cwd(), ".data");
const MOCK_LEADS_FILE = path.join(MOCK_DATA_DIR, "leads.json");

/**
 * Deterministic fingerprint over (email, phone, service) — stored on every lead so duplicate
 * detection is an indexed lookup, auditable after the fact, instead of only a live heuristic
 * computed at submit time (see findRecentDuplicate below, which now uses this same fingerprint).
 */
function dedupFingerprint(email: string, phone: string, serviceId: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.replace(/\D/g, "");
  return createHash("sha256").update(`${normalizedEmail}|${normalizedPhone}|${serviceId}`).digest("hex");
}

async function readMockLeads(): Promise<StoredLead[]> {
  try {
    const raw = await fs.readFile(MOCK_LEADS_FILE, "utf-8");
    return JSON.parse(raw) as StoredLead[];
  } catch {
    return [];
  }
}

async function writeMockLeads(leads: StoredLead[]) {
  await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  await fs.writeFile(MOCK_LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
}

/**
 * Returns true if a near-duplicate submission (same email + phone + service)
 * was created within the last 10 minutes — used to silently dedupe accidental
 * double-clicks/double-submits rather than creating two leads.
 */
export async function findRecentDuplicate(input: QuoteRequestInput): Promise<string | null> {
  const windowStart = new Date(Date.now() - 10 * 60 * 1000);
  const fingerprint = dedupFingerprint(input.email, input.phone, input.service);

  if (isDatabaseConfigured && prisma) {
    const existing = await prisma.lead.findFirst({
      where: { createdAt: { gte: windowStart }, dedupFingerprint: fingerprint },
      orderBy: { createdAt: "desc" },
    });
    return existing?.reference ?? null;
  }

  const leads = await readMockLeads();
  const match = leads.find(
    (l) =>
      l.input.email === input.email &&
      l.input.phone === input.phone &&
      l.input.service === input.service &&
      new Date(l.createdAt) >= windowStart
  );
  return match?.reference ?? null;
}

/**
 * `loggedInCustomerId` (from the customer session, never client-supplied) links this new
 * request to the submitter's existing account instead of always spawning a fresh guest
 * Customer row -- without this, a logged-in customer's later requests would never show up
 * in their own /account history, since nothing would tie the new Lead back to their account.
 */
export async function createLead(input: QuoteRequestInput, estimate: EstimateResult, loggedInCustomerId?: string) {
  const reference = generateReference();

  if (isDatabaseConfigured && prisma) {
    const service = await prisma.serviceCatalogItem.upsert({
      where: { slug: input.service },
      update: {},
      create: { slug: input.service, name: input.service, description: "" },
    });

    const existingCustomer = loggedInCustomerId
      ? await prisma.customer.findUnique({ where: { id: loggedInCustomerId } })
      : null;

    const customer = existingCustomer
      ? existingCustomer
      : await prisma.customer.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            communicationPreference: {
              create: { smsConsent: input.smsConsent, emailConsent: input.emailConsent },
            },
          },
        });

    if (existingCustomer) {
      await prisma.communicationPreference.upsert({
        where: { customerId: existingCustomer.id },
        update: { smsConsent: input.smsConsent, emailConsent: input.emailConsent },
        create: { customerId: existingCustomer.id, smsConsent: input.smsConsent, emailConsent: input.emailConsent },
      });
    }

    const address = await prisma.address.create({
      data: {
        customerId: customer.id,
        line1: "Provided at booking confirmation",
        city: "Spokane Valley",
        state: "WA",
        zip: input.zip,
        propertyType: input.propertyType,
      },
    });

    const lead = await prisma.lead.create({
      data: {
        reference,
        customerId: customer.id,
        addressId: address.id,
        serviceId: service.id,
        source: input.source || "website",
        campaign: input.campaign,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmContent: input.utmContent,
        referrer: input.referrer,
        dedupFingerprint: dedupFingerprint(input.email, input.phone, input.service),
        preferredContactMethod: input.preferredContactMethod,
        additionalInstructions: input.additionalInstructions || null,
        promoCode: input.promoCode || null,
        quoteRequest: {
          create: {
            propertyType: input.propertyType,
            squareFeet: input.squareFeet,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            condition: input.condition,
            frequency: input.frequency,
            hasPets: input.hasPets,
            lastProfessionalCleaning: input.lastProfessionalCleaning || null,
            preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
            addOns: input.addOns,
            estimateLow: estimate.requiresManualQuote ? null : estimate.totalLow,
            estimateHigh: estimate.requiresManualQuote ? null : estimate.totalHigh,
            requiresManualQuote: estimate.requiresManualQuote,
            smsConsent: input.smsConsent,
            emailConsent: input.emailConsent,
          },
        },
        // Sent synchronously right after this in /api/quote — recorded as SENT immediately rather
        // than PENDING, since there's no separate processing step for this particular event type.
        automationEvents: { create: { type: "NEW_LEAD", status: "SENT", processedAt: new Date() } },
      },
    });

    return { id: lead.id, reference: lead.reference, persisted: "database" as const };
  }

  const leads = await readMockLeads();
  const now = new Date().toISOString();
  leads.push({
    id: reference,
    reference,
    status: "NEW",
    source: input.source || "website",
    campaign: input.campaign,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmContent: input.utmContent,
    referrer: input.referrer,
    input,
    estimate,
    createdAt: now,
    updatedAt: now,
  });
  await writeMockLeads(leads);

  return { id: reference, reference, persisted: "mock-json" as const };
}

function mapLead(
  l: NonNullable<Awaited<ReturnType<typeof _prismaFindLeadWithRelations>>>
): StoredLead {
  return {
    id: l.id,
    reference: l.reference,
    status: l.status as LeadStatusValue,
    lostReason: l.lostReason,
    source: l.source,
    campaign: l.campaign ?? undefined,
    utmSource: l.utmSource ?? undefined,
    utmMedium: l.utmMedium ?? undefined,
    utmContent: l.utmContent ?? undefined,
    referrer: l.referrer ?? undefined,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    input: {
      firstName: l.customer?.firstName ?? "",
      lastName: l.customer?.lastName ?? "",
      email: l.customer?.email ?? "",
      phone: l.customer?.phone ?? "",
      service: l.service.slug as QuoteRequestInput["service"],
      zip: l.address?.zip ?? "",
      propertyType: (l.quoteRequest?.propertyType as QuoteRequestInput["propertyType"]) ?? "house",
      squareFeet: l.quoteRequest?.squareFeet ?? 0,
      bedrooms: l.quoteRequest?.bedrooms ?? 0,
      bathrooms: l.quoteRequest?.bathrooms ?? 0,
      condition: (l.quoteRequest?.condition as QuoteRequestInput["condition"]) ?? "normal",
      frequency: (l.quoteRequest?.frequency as QuoteRequestInput["frequency"]) ?? "one-time",
      hasPets: l.quoteRequest?.hasPets ?? false,
      preferredContactMethod: l.preferredContactMethod,
      smsConsent: l.quoteRequest?.smsConsent ?? false,
      emailConsent: l.quoteRequest?.emailConsent ?? false,
      policiesAccepted: true,
      addOns: (l.quoteRequest?.addOns ?? []) as QuoteRequestInput["addOns"],
      additionalInstructions: l.additionalInstructions ?? undefined,
      promoCode: l.promoCode ?? undefined,
    } as QuoteRequestInput,
    estimate: {
      requiresManualQuote: l.quoteRequest?.requiresManualQuote ?? false,
      low: l.quoteRequest?.estimateLow ?? 0,
      high: l.quoteRequest?.estimateHigh ?? 0,
      addOnsLow: 0,
      addOnsHigh: 0,
      totalLow: l.quoteRequest?.estimateLow ?? 0,
      totalHigh: l.quoteRequest?.estimateHigh ?? 0,
      durationHoursLow: 0,
      durationHoursHigh: 0,
      breakdown: [],
    } satisfies EstimateResult,
  };
}

function _prismaFindLeadWithRelations() {
  return prisma!.lead.findFirst({
    include: { customer: true, quoteRequest: true, service: true, address: true },
  });
}

/** Admin-facing read path; used by the lead dashboard. */
export async function listLeads(): Promise<StoredLead[]> {
  if (isDatabaseConfigured && prisma) {
    const leads = await prisma.lead.findMany({
      where: { deletedAt: null },
      include: { customer: true, quoteRequest: true, service: true, address: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return leads.map(mapLead);
  }

  const leads = await readMockLeads();
  return leads.slice().reverse();
}

export async function getLeadById(id: string): Promise<StoredLead | null> {
  if (isDatabaseConfigured && prisma) {
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true, quoteRequest: true, service: true, address: true },
    });
    return lead ? mapLead(lead) : null;
  }
  const leads = await readMockLeads();
  return leads.find((l) => l.id === id) ?? null;
}

/** Case-insensitive lookup by the human-friendly reference (e.g. "ACM-26-AC6372") -- used by the
 *  admin assistant so a typed/pasted reference number can resolve to a real lead. */
export async function getLeadByReference(reference: string): Promise<StoredLead | null> {
  const ref = reference.trim().toUpperCase();
  if (isDatabaseConfigured && prisma) {
    const lead = await prisma.lead.findFirst({
      where: { reference: ref, deletedAt: null },
      include: { customer: true, quoteRequest: true, service: true, address: true },
    });
    return lead ? mapLead(lead) : null;
  }
  const leads = await readMockLeads();
  return leads.find((l) => l.reference.toUpperCase() === ref) ?? null;
}

export interface DeleteLeadResult {
  ok: boolean;
  error?: string;
}

/**
 * Real bug fixed (2026-09-24): deleting a lead only soft-deleted the Lead row itself -- its
 * Quotes stayed fully live (deletedAt: null), so an ACCEPTED quote's value kept counting in
 * revenue/net-revenue figures (reportsStore.ts, financeStore.ts, the Abbie Assistant's
 * get_net_revenue tool) even after the lead it belonged to was "deleted." Now: if the lead has a
 * real PAID payment anywhere in its Quote -> Booking -> Payment chain, deletion is refused
 * outright (real collected money must never silently vanish from the record -- void the
 * quote/invoice instead if it needs to be corrected). Otherwise, deleting the lead also soft-
 * deletes its quotes in the same transaction, so revenue figures correctly reflect the deletion.
 */
export async function deleteLead(id: string, adminUserId: string): Promise<DeleteLeadResult> {
  if (isDatabaseConfigured && prisma) {
    const before = await prisma.lead.findUnique({
      where: { id },
      include: { quotes: { where: { deletedAt: null }, include: { bookings: { include: { payments: { select: { status: true } } } } } } },
    });
    if (!before || before.deletedAt) return { ok: false, error: "Not found" };

    const hasRealPayment = before.quotes.some((q) => q.bookings.some((b) => b.payments.some((p) => p.status === "PAID")));
    if (hasRealPayment) {
      return { ok: false, error: "This lead has a real payment on file and can't be deleted. Cancel/void the quote or invoice instead if it needs to be corrected." };
    }

    const quoteIds = before.quotes.map((q) => q.id);
    await prisma.$transaction([
      ...(quoteIds.length > 0 ? [prisma.quote.updateMany({ where: { id: { in: quoteIds } }, data: { deletedAt: new Date() } })] : []),
      prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    await prisma.auditLog.create({
      data: { adminUserId, action: "lead.deleted", entityType: "lead", entityId: id, before: { reference: before.reference, cascadedQuoteIds: quoteIds } },
    });
    return { ok: true };
  }
  const leads = await readMockLeads();
  const next = leads.filter((l) => l.id !== id);
  if (next.length === leads.length) return { ok: false, error: "Not found" };
  await writeMockLeads(next);
  return { ok: true };
}

export async function updateLeadStatus(
  id: string,
  data: { status: LeadStatusValue; lostReason?: string },
  adminUserId: string
): Promise<StoredLead | null> {
  if (isDatabaseConfigured && prisma) {
    const before = await prisma.lead.findUnique({ where: { id } });
    if (!before) return null;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status: data.status,
        lostReason: data.status === "LOST" ? data.lostReason ?? null : null,
      },
      include: { customer: true, quoteRequest: true, service: true, address: true },
    });

    await prisma.auditLog.create({
      data: {
        adminUserId,
        action: "lead.status_changed",
        entityType: "lead",
        entityId: id,
        before: { status: before.status },
        after: { status: lead.status, lostReason: lead.lostReason },
      },
    });

    return mapLead(lead);
  }

  const leads = await readMockLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], status: data.status, lostReason: data.status === "LOST" ? data.lostReason ?? null : null, updatedAt: new Date().toISOString() };
  await writeMockLeads(leads);
  return leads[idx];
}

export async function listLeadActivity(leadId: string): Promise<LeadActivityEntry[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const logs = await prisma.auditLog.findMany({
    where: { entityType: "lead", entityId: leadId },
    include: { adminUser: true },
    orderBy: { createdAt: "desc" },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    before: l.before,
    after: l.after,
    adminName: l.adminUser?.name ?? null,
    createdAt: l.createdAt.toISOString(),
  }));
}
