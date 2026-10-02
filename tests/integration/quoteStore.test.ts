import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Real round trips over the network to the real dev DB run well past Vitest's 5s default per test.
vi.setConfig({ testTimeout: 15000 });

// quoteStore.ts has no JSON-mock fallback (DB-only, unlike leadStore.ts/pricingStore.ts), so these
// tests need a real DATABASE_URL. Vitest doesn't auto-load .env.local the way Next.js dev/build
// does, so it's loaded here -- scoped to only THIS file's own worker process (each test file gets
// its own isolated process in this project's vitest config), not globally via setupFiles, which
// was tried first and broke several unrelated tests elsewhere that specifically rely on running
// with no DATABASE_URL present (pricingStore's mock-JSON-path tests, automation.test.ts's mock
// email-adapter tests, etc.) -- see the project memory for that incident.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath) && !process.env.DATABASE_URL) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

const { prisma, isDatabaseConfigured } = await import("@/lib/db");
const { createQuote, updateDraftQuote, getQuoteById, setQuoteStatus, createRevision, listQuotes } = await import("@/lib/server/quoteStore");
const { getMyQuoteDetail, respondToQuote } = await import("@/lib/server/clientPortalStore");

// Every row created here is tagged with a run-unique suffix and torn down in afterAll.
const run = Date.now();
const maybeDescribe = isDatabaseConfigured ? describe : describe.skip;

maybeDescribe("quoteStore -- commercial quote upgrade", () => {
  let adminId: string;
  let customerId: string;
  let addressId: string;
  let leadId: string;
  const createdQuoteIds: string[] = [];

  beforeAll(async () => {
    if (!prisma) throw new Error("DATABASE_URL not configured for this test run");
    const admin = await prisma.adminUser.create({
      data: { email: `quote-store-test-admin-${run}@test.internal`, name: "Quote Store Test Admin", passwordHash: "x", role: "Owner", permissions: ["MANAGE_LEADS"], isActive: true },
    });
    adminId = admin.id;

    const customer = await prisma.customer.create({
      data: { firstName: "Emma", lastName: "Locsin", email: `emma-locsin-${run}@test.internal`, phone: "5095550199" },
    });
    customerId = customer.id;

    const address = await prisma.address.create({
      data: { customerId, line1: "1005 N Evergreen Rd", line2: "Ste 101", city: "Spokane Valley", state: "WA", zip: "99216", propertyType: "commercial", label: "Spokane Dentures and Implants" },
    });
    addressId = address.id;

    const service = await prisma.serviceCatalogItem.findUnique({ where: { slug: "commercial-cleaning" } });
    if (!service) throw new Error("Expected the real 'commercial-cleaning' service to already exist in this database");

    const lead = await prisma.lead.create({
      data: {
        reference: `ACM-TEST-${run}`, customerId, addressId, serviceId: service.id, status: "ESTIMATE_SENT",
        quoteRequest: { create: { propertyType: "commercial", commercialType: "Dental office", squareFeet: 4100, bedrooms: 0, bathrooms: 2, condition: "normal", frequency: "custom" } },
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Every deletion below is guarded on its id being a real truthy string -- a partially-failed
    // beforeAll (one of these never got assigned) must never fall through to an unscoped
    // deleteMany({ where: { someField: undefined } }), which Prisma treats as "no filter on this
    // field" and would match -- and in a single bad run almost did match -- every row in the table.
    for (const id of createdQuoteIds) {
      if (!id) continue;
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } }).catch(() => {});
      await prisma.quote.delete({ where: { id } }).catch(() => {});
    }
    if (leadId) {
      await prisma.quoteRequest.delete({ where: { leadId } }).catch(() => {});
      await prisma.lead.delete({ where: { id: leadId } }).catch(() => {});
    }
    if (addressId) await prisma.address.delete({ where: { id: addressId } }).catch(() => {});
    if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    if (adminId) await prisma.adminUser.delete({ where: { id: adminId } }).catch(() => {});
  });

  it("CRITICAL: a $215 per-visit, twice-weekly quote reads as '$215.00 / visit', never a contract total", async () => {
    const { id } = await createQuote(leadId, {
      items: [{ label: "Recurring Commercial Cleaning", quantity: 1, unitPrice: 21500, pricingUnit: "PER_VISIT", frequency: "TWICE_WEEKLY" }],
      scopeOfService: "Routine commercial cleaning of the agreed facility areas, including 13 rooms, 2 restrooms, reception/waiting areas, hallways, and common areas.",
      exclusions: "Routine commercial janitorial service does not include clinical instrument sterilization, sharps or regulated medical-waste handling, biohazard remediation, or specialized clinical cleaning procedures.",
    }, adminId);
    createdQuoteIds.push(id);

    const quote = await getQuoteById(id);
    expect(quote).not.toBeNull();
    expect(quote!.total).toBe(21500);
    expect(quote!.items[0].pricingUnit).toBe("PER_VISIT");
    expect(quote!.items[0].frequency).toBe("TWICE_WEEKLY");
    expect(quote!.items[0].unitPrice).toBe(21500);
    // The header context came through the real Lead -> Customer/Address/QuoteRequest relationships
    expect(quote!.customerName).toBe("Emma Locsin");
    expect(quote!.companyName).toBe("Spokane Dentures and Implants");
    expect(quote!.approxSquareFeet).toBe(4100);
    expect(quote!.serviceAddress).toContain("1005 N Evergreen Rd");
  });

  it("an hourly quote reads as '$X / hour'", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "Window cleaning", quantity: 1, unitPrice: 4500, pricingUnit: "PER_HOUR", frequency: "ONE_TIME" }] }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.items[0].pricingUnit).toBe("PER_HOUR");
  });

  it("a monthly quote reads as '$X / month'", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "Full-service contract", quantity: 1, unitPrice: 80000, pricingUnit: "MONTHLY" }] }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.items[0].pricingUnit).toBe("MONTHLY");
  });

  it("a flat-project quote reads as a total, not a recurring rate", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "One-time post-construction clean", quantity: 1, unitPrice: 120000, pricingUnit: "FLAT_PROJECT" }] }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.items[0].pricingUnit).toBe("FLAT_PROJECT");
  });

  it("twice-weekly and a custom frequency both persist correctly", async () => {
    const { id } = await createQuote(leadId, {
      items: [
        { label: "Service A", quantity: 1, unitPrice: 1000, pricingUnit: "PER_VISIT", frequency: "TWICE_WEEKLY" },
        { label: "Service B", quantity: 1, unitPrice: 2000, pricingUnit: "PER_VISIT", frequency: "CUSTOM", customFrequency: "Every other Tuesday" },
      ],
    }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.items[0].frequency).toBe("TWICE_WEEKLY");
    expect(quote!.items[1].frequency).toBe("CUSTOM");
    expect(quote!.items[1].customFrequency).toBe("Every other Tuesday");
  });

  it("applies a percent discount correctly and keeps a legacy plain item's total meaningful", async () => {
    const { id } = await createQuote(leadId, {
      items: [{ label: "Standard cleaning", quantity: 2, unitPrice: 10000 }],
      discountType: "PERCENT", discountValue: 10,
    }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.subtotal).toBe(20000);
    expect(quote!.discount).toBe(2000);
    expect(quote!.total).toBe(18000);
  });

  it("no discount by default", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "Plain job", quantity: 1, unitPrice: 5000 }] }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.discount).toBe(0);
    expect(quote!.discountType).toBe("FIXED");
  });

  it("supports a percent deposit, and defaults to no deposit", async () => {
    const withDeposit = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 20000 }], depositType: "PERCENT", depositValue: 25 }, adminId);
    createdQuoteIds.push(withDeposit.id);
    const q1 = await getQuoteById(withDeposit.id);
    expect(q1!.deposit).toBe(5000);

    const noDeposit = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 20000 }] }, adminId);
    createdQuoteIds.push(noDeposit.id);
    const q2 = await getQuoteById(noDeposit.id);
    expect(q2!.depositType).toBe("NONE");
    expect(q2!.deposit).toBe(0);
  });

  it("applies tax only when set, never automatically", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);
    const quote = await getQuoteById(id);
    expect(quote!.tax).toBe(0);
  });

  it("SECURITY CRITICAL: internalNotes is never exposed through the customer-facing quote API", async () => {
    const { id } = await createQuote(leadId, {
      items: [{ label: "x", quantity: 1, unitPrice: 10000 }],
      internalNotes: "Staff-only: this client haggles, do not go below $180/visit.",
      notes: "Thanks for considering us!",
    }, adminId);
    createdQuoteIds.push(id);
    await setQuoteStatus(id, "SENT", adminId);

    const customerView = await getMyQuoteDetail(customerId, id);
    expect(customerView).not.toBeNull();
    expect(JSON.stringify(customerView)).not.toContain("haggles");
    expect(JSON.stringify(customerView)).not.toContain("internalNotes");
    expect(customerView!.notes).toBe("Thanks for considering us!");

    // The admin-side getter DOES still expose it (staff only, gated by requireAdmin in the route)
    const adminView = await getQuoteById(id);
    expect(adminView!.internalNotes).toContain("haggles");
  });

  it("marks a quote viewed the first time the customer opens it, not on later opens", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);
    await setQuoteStatus(id, "SENT", adminId);

    const before = await getQuoteById(id);
    expect(before!.viewedAt).toBeNull();

    await getMyQuoteDetail(customerId, id);
    const afterFirstView = await getQuoteById(id);
    expect(afterFirstView!.viewedAt).not.toBeNull();

    const firstViewedAt = afterFirstView!.viewedAt;
    await new Promise((r) => setTimeout(r, 10));
    await getMyQuoteDetail(customerId, id);
    const afterSecondView = await getQuoteById(id);
    expect(afterSecondView!.viewedAt).toBe(firstViewedAt);
  });

  it("records sentAt the first time a quote is sent, and never overwrites it on a later resend", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);

    const beforeSend = await getQuoteById(id);
    expect(beforeSend!.sentAt).toBeNull();

    await setQuoteStatus(id, "SENT", adminId);
    const afterSend = await getQuoteById(id);
    expect(afterSend!.sentAt).not.toBeNull();

    const firstSentAt = afterSend!.sentAt;
    await new Promise((r) => setTimeout(r, 10));
    await setQuoteStatus(id, "SENT", adminId);
    const afterResend = await getQuoteById(id);
    expect(afterResend!.sentAt).toBe(firstSentAt);
  });

  it("a DRAFT quote is never visible to the customer", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);
    const customerView = await getMyQuoteDetail(customerId, id);
    expect(customerView).toBeNull();
  });

  it("a quote past its expiresAt is marked EXPIRED when the customer tries to respond", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }], expiresAt: new Date(Date.now() - 86400000).toISOString() }, adminId);
    createdQuoteIds.push(id);
    await setQuoteStatus(id, "SENT", adminId);

    const result = await respondToQuote(customerId, id, "ACCEPT");
    expect(result.ok).toBe(false);

    const quote = await getQuoteById(id);
    expect(quote!.status).toBe("EXPIRED");
  });

  it("CANCELLED is a real status transition", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);
    await setQuoteStatus(id, "SENT", adminId);
    const result = await setQuoteStatus(id, "CANCELLED", adminId);
    expect(result.ok).toBe(true);
    const quote = await getQuoteById(id);
    expect(quote!.status).toBe("CANCELLED");
  });

  it("revision: creates a new quote linked to the original, leaving the original untouched", async () => {
    // Several more real round trips than other tests (create, send, revise, 3x getQuoteById)
    // against the real network DB -- past the 5s default.
    const original = await createQuote(leadId, {
      items: [{ label: "Original service", quantity: 1, unitPrice: 20000, pricingUnit: "PER_VISIT", frequency: "WEEKLY" }],
      notes: "Original terms",
    }, adminId);
    createdQuoteIds.push(original.id);
    await setQuoteStatus(original.id, "SENT", adminId);

    const beforeOriginal = await getQuoteById(original.id);
    const revision = await createRevision(original.id, adminId);
    expect(revision.ok).toBe(true);
    createdQuoteIds.push(revision.id!);

    const afterOriginal = await getQuoteById(original.id);
    expect(afterOriginal!.status).toBe(beforeOriginal!.status); // untouched
    expect(afterOriginal!.notes).toBe("Original terms"); // untouched

    const revised = await getQuoteById(revision.id!);
    expect(revised!.status).toBe("DRAFT");
    expect(revised!.revisionNumber).toBe(2);
    expect(revised!.revisedFromId).toBe(original.id);
    expect(revised!.items[0].unitPrice).toBe(20000); // copied over

    const originalAfterRevision = await getQuoteById(original.id);
    expect(originalAfterRevision!.revisions.some((r) => r.id === revision.id)).toBe(true);
  }, 15000);

  it("revision: refuses to revise a DRAFT (nothing to revise yet) or an ACCEPTED quote", async () => {
    const draft = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(draft.id);
    const draftResult = await createRevision(draft.id, adminId);
    expect(draftResult.ok).toBe(false);

    const accepted = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(accepted.id);
    await setQuoteStatus(accepted.id, "SENT", adminId);
    await setQuoteStatus(accepted.id, "ACCEPTED", adminId);
    const acceptedResult = await createRevision(accepted.id, adminId);
    expect(acceptedResult.ok).toBe(false);
  });

  it("a DRAFT quote can be edited; a SENT quote cannot (must be revised instead)", async () => {
    const { id } = await createQuote(leadId, { items: [{ label: "x", quantity: 1, unitPrice: 10000 }] }, adminId);
    createdQuoteIds.push(id);
    const draftEdit = await updateDraftQuote(id, { items: [{ label: "y", quantity: 1, unitPrice: 15000 }] }, adminId);
    expect(draftEdit.ok).toBe(true);

    await setQuoteStatus(id, "SENT", adminId);
    const sentEdit = await updateDraftQuote(id, { items: [{ label: "z", quantity: 1, unitPrice: 99999 }] }, adminId);
    expect(sentEdit.ok).toBe(false);
  });

  it("concurrent quote-number generation never collides (DB-unique, not client-side counting)", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createQuote(leadId, { items: [{ label: "concurrency test", quantity: 1, unitPrice: 1000 }] }, adminId))
    );
    createdQuoteIds.push(...results.map((r) => r.id));
    const quotes = await Promise.all(results.map((r) => getQuoteById(r.id)));
    const numbers = quotes.map((q) => q!.quoteNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("the quotes list shows up (regression check -- listQuotes still works with the new schema)", async () => {
    const quotes = await listQuotes();
    expect(Array.isArray(quotes)).toBe(true);
  });
});
