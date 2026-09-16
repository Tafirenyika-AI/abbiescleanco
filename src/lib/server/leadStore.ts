import { promises as fs } from "fs";
import path from "path";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { generateReference } from "@/lib/reference";
import type { QuoteRequestInput } from "@/lib/validation/quote";
import type { EstimateResult } from "@/lib/pricing";

export interface StoredLead {
  reference: string;
  status: "NEW";
  source: string;
  campaign?: string;
  input: QuoteRequestInput;
  estimate: EstimateResult;
  createdAt: string;
}

const MOCK_DATA_DIR = path.join(process.cwd(), ".data");
const MOCK_LEADS_FILE = path.join(MOCK_DATA_DIR, "leads.json");

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

  if (isDatabaseConfigured && prisma) {
    const existing = await prisma.lead.findFirst({
      where: {
        createdAt: { gte: windowStart },
        customer: { email: input.email, phone: input.phone },
      },
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

export async function createLead(input: QuoteRequestInput, estimate: EstimateResult) {
  const reference = generateReference();

  if (isDatabaseConfigured && prisma) {
    const service = await prisma.serviceCatalogItem.upsert({
      where: { slug: input.service },
      update: {},
      create: { slug: input.service, name: input.service, description: "" },
    });

    const customer = await prisma.customer.create({
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
        preferredContactMethod: input.preferredContactMethod,
        additionalInstructions: input.additionalInstructions || null,
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
        automationEvents: { create: { type: "NEW_LEAD", status: "PENDING" } },
      },
    });

    return { reference: lead.reference, persisted: "database" as const };
  }

  const leads = await readMockLeads();
  leads.push({
    reference,
    status: "NEW",
    source: input.source || "website",
    campaign: input.campaign,
    input,
    estimate,
    createdAt: new Date().toISOString(),
  });
  await writeMockLeads(leads);

  return { reference, persisted: "mock-json" as const };
}

/** Admin-facing read path; used by the lead dashboard. */
export async function listLeads(): Promise<StoredLead[]> {
  if (isDatabaseConfigured && prisma) {
    const leads = await prisma.lead.findMany({
      include: { customer: true, quoteRequest: true, service: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return leads.map((l) => ({
      reference: l.reference,
      status: "NEW",
      source: l.source,
      campaign: l.campaign ?? undefined,
      createdAt: l.createdAt.toISOString(),
      input: {
        firstName: l.customer?.firstName ?? "",
        lastName: l.customer?.lastName ?? "",
        email: l.customer?.email ?? "",
        phone: l.customer?.phone ?? "",
        service: l.service.slug as QuoteRequestInput["service"],
        zip: "",
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
    }));
  }

  const leads = await readMockLeads();
  return leads.slice().reverse();
}
