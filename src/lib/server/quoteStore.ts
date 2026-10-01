import { prisma, isDatabaseConfigured } from "@/lib/db";
import { generateReference } from "@/lib/reference";
import { redeemPromoCode } from "@/lib/server/promoCodeStore";
import { estimateInternalMonthlyValueCents, computeQuoteTotals } from "@/lib/quotePricing";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Quotes require DATABASE_URL to be configured.");
  return prisma;
}

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"] as const;
export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

export interface QuoteItemInput {
  label: string;
  quantity: number;
  unitPrice: number; // cents
  pricingUnit?: string | null;
  frequency?: string | null;
  customFrequency?: string | null;
}

export interface QuoteItemDetail {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricingUnit: string | null;
  frequency: string | null;
  customFrequency: string | null;
}

export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  status: QuoteStatusValue;
  total: number;
  deposit: number;
  primaryPricingUnit: string | null; // for a unit-aware display in the list (e.g. "$215.00 / visit" instead of a bare total)
  createdAt: string;
  expiresAt: string | null;
  customerName: string;
  serviceName: string;
  leadId: string;
  revisionNumber: number;
}

function computeTotals(items: QuoteItemInput[], discountType: string, discountValue: number, tax: number, depositType: string, depositValue: number) {
  return computeQuoteTotals({ items, discountType, discountValue, tax, depositType, depositValue });
}

export interface LeadQuoteContext {
  leadId: string;
  leadReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName: string | null; // Address.label, reused as the commercial property's company name -- see docs/DECISIONS.md
  serviceAddress: string | null;
  serviceName: string;
  commercialType: string | null;
  approxSquareFeet: number | null;
}

/**
 * Everything the quote builder's "Client / Property" header needs, fetched through the real
 * Lead -> Customer/Address/QuoteRequest relationships -- nothing here is duplicated into a new
 * table, and nothing is written back to the lead.
 */
export async function getLeadQuoteContext(leadId: string): Promise<LeadQuoteContext | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { customer: true, address: true, service: true, quoteRequest: true },
  });
  if (!lead) return null;
  const addr = lead.address;
  return {
    leadId: lead.id,
    leadReference: lead.reference,
    customerName: lead.customer ? `${lead.customer.firstName} ${lead.customer.lastName}`.trim() : "",
    customerEmail: lead.customer?.email ?? "",
    customerPhone: lead.customer?.phone ?? "",
    companyName: addr?.label ?? null,
    serviceAddress: addr ? `${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}, ${addr.city}, ${addr.state} ${addr.zip}` : null,
    serviceName: lead.service.name,
    commercialType: lead.quoteRequest?.commercialType ?? null,
    approxSquareFeet: lead.quoteRequest?.squareFeet ?? null,
  };
}

export async function listQuotes(): Promise<QuoteListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const quotes = await prisma.quote.findMany({
    where: { deletedAt: null },
    include: { lead: { include: { customer: true, service: true } }, items: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    total: q.total,
    deposit: q.deposit,
    primaryPricingUnit: q.items[0]?.pricingUnit ?? null,
    createdAt: q.createdAt.toISOString(),
    expiresAt: q.expiresAt?.toISOString() ?? null,
    customerName: q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "—",
    serviceName: q.lead.service.name,
    leadId: q.leadId,
    revisionNumber: q.revisionNumber,
  }));
}

export interface QuoteDetail {
  id: string;
  quoteNumber: string;
  status: QuoteStatusValue;
  subtotal: number;
  discount: number;
  discountType: string;
  discountValue: number;
  tax: number;
  deposit: number;
  depositType: string;
  depositValue: number;
  total: number;
  expiresAt: string | null;
  notes: string | null; // customer-facing "Customer Notes / Terms"
  internalNotes: string | null; // staff-only -- admin UI only, never customer-facing
  scopeOfService: string | null;
  exclusions: string | null;
  customerMessage: string | null;
  createdAt: string;
  viewedAt: string | null;
  revisionNumber: number;
  revisedFromId: string | null;
  revisions: { id: string; quoteNumber: string; revisionNumber: number; status: QuoteStatusValue; createdAt: string }[];
  leadId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName: string | null; // Address.label, reused as the commercial property's company name -- see docs/DECISIONS.md
  serviceAddress: string | null;
  leadReference: string;
  serviceName: string;
  approxSquareFeet: number | null;
  internalEstimatedMonthlyValue: number | null; // analytics only, never shown to the customer
  items: QuoteItemDetail[];
}

function mapItem(i: { id: string; label: string; quantity: number; unitPrice: number; total: number; pricingUnit: string | null; frequency: string | null; customFrequency: string | null }): QuoteItemDetail {
  return { id: i.id, label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, pricingUnit: i.pricingUnit, frequency: i.frequency, customFrequency: i.customFrequency };
}

export async function getQuoteById(id: string): Promise<QuoteDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const q = await prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include: {
      lead: { include: { customer: true, service: true, address: true, quoteRequest: true } },
      items: { orderBy: { createdAt: "asc" } },
      revisions: { orderBy: { revisionNumber: "asc" }, select: { id: true, quoteNumber: true, revisionNumber: true, status: true, createdAt: true } },
    },
  });
  if (!q) return null;
  const primaryItem = q.items.find((i) => i.pricingUnit) ?? q.items[0];
  const addr = q.lead.address;
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    subtotal: q.subtotal,
    discount: q.discount,
    discountType: q.discountType,
    discountValue: q.discountValue,
    tax: q.tax,
    deposit: q.deposit,
    depositType: q.depositType,
    depositValue: q.depositValue,
    total: q.total,
    expiresAt: q.expiresAt?.toISOString() ?? null,
    notes: q.notes,
    internalNotes: q.internalNotes,
    scopeOfService: q.scopeOfService,
    exclusions: q.exclusions,
    customerMessage: q.customerMessage,
    createdAt: q.createdAt.toISOString(),
    viewedAt: q.viewedAt?.toISOString() ?? null,
    revisionNumber: q.revisionNumber,
    revisedFromId: q.revisedFromId,
    revisions: q.revisions.map((r) => ({ id: r.id, quoteNumber: r.quoteNumber, revisionNumber: r.revisionNumber, status: r.status, createdAt: r.createdAt.toISOString() })),
    leadId: q.leadId,
    customerName: q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "—",
    customerEmail: q.lead.customer?.email ?? "",
    customerPhone: q.lead.customer?.phone ?? "",
    companyName: addr?.label ?? null,
    serviceAddress: addr ? `${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}, ${addr.city}, ${addr.state} ${addr.zip}` : null,
    leadReference: q.lead.reference,
    serviceName: q.lead.service.name,
    approxSquareFeet: q.lead.quoteRequest?.squareFeet ?? null,
    internalEstimatedMonthlyValue: primaryItem ? estimateInternalMonthlyValueCents(primaryItem.unitPrice, primaryItem.pricingUnit, primaryItem.frequency) : null,
    items: q.items.map(mapItem),
  };
}

export interface QuoteMutableFields {
  items: QuoteItemInput[];
  discountType?: string;
  discountValue?: number;
  tax?: number;
  depositType?: string;
  depositValue?: number;
  expiresAt?: string;
  notes?: string;
  internalNotes?: string;
  scopeOfService?: string;
  exclusions?: string;
  customerMessage?: string;
  promoCodeId?: string;
}

function itemsCreateInput(items: QuoteItemInput[]) {
  return items.map((i) => ({
    label: i.label,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.quantity * i.unitPrice,
    pricingUnit: i.pricingUnit || null,
    frequency: i.frequency || null,
    customFrequency: i.frequency === "CUSTOM" ? i.customFrequency || null : null,
  }));
}

export async function createQuote(leadId: string, data: QuoteMutableFields, adminUserId: string): Promise<{ id: string }> {
  const discountType = data.discountType ?? "FIXED";
  const discountValue = data.discountValue ?? 0;
  const depositType = data.depositType ?? "NONE";
  const depositValue = data.depositValue ?? 0;
  const { subtotal, discount, deposit, total } = computeTotals(data.items, discountType, discountValue, data.tax ?? 0, depositType, depositValue);
  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId,
      subtotal,
      discount,
      discountType,
      discountValue,
      tax: data.tax ?? 0,
      deposit,
      depositType,
      depositValue,
      total,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes,
      internalNotes: data.internalNotes,
      scopeOfService: data.scopeOfService,
      exclusions: data.exclusions,
      customerMessage: data.customerMessage,
      promoCodeId: data.promoCodeId,
      items: { create: itemsCreateInput(data.items) },
    },
  });
  if (data.promoCodeId) await redeemPromoCode(data.promoCodeId);
  await db().auditLog.create({
    data: { adminUserId, action: "quote.created", entityType: "quote", entityId: quote.id, after: { quoteNumber: quote.quoteNumber, total } },
  });
  return { id: quote.id };
}

/** Only DRAFT quotes can have their terms edited — once sent, the numbers a customer saw are frozen. Use createRevision instead. */
export async function updateDraftQuote(id: string, data: QuoteMutableFields, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().quote.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Quote not found" };
  if (existing.status !== "DRAFT") return { ok: false, error: "Only draft quotes can be edited. Create a revision to make changes." };

  const discountType = data.discountType ?? "FIXED";
  const discountValue = data.discountValue ?? 0;
  const depositType = data.depositType ?? "NONE";
  const depositValue = data.depositValue ?? 0;
  const { subtotal, discount, deposit, total } = computeTotals(data.items, discountType, discountValue, data.tax ?? 0, depositType, depositValue);
  await db().quoteItem.deleteMany({ where: { quoteId: id } });
  await db().quote.update({
    where: { id },
    data: {
      subtotal,
      discount,
      discountType,
      discountValue,
      tax: data.tax ?? 0,
      deposit,
      depositType,
      depositValue,
      total,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes,
      internalNotes: data.internalNotes,
      scopeOfService: data.scopeOfService,
      exclusions: data.exclusions,
      customerMessage: data.customerMessage,
      items: { create: itemsCreateInput(data.items) },
    },
  });
  await db().auditLog.create({
    data: { adminUserId, action: "quote.edited", entityType: "quote", entityId: id, before: { total: existing.total }, after: { total } },
  });
  return { ok: true };
}

export async function setQuoteStatus(id: string, status: QuoteStatusValue, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().quote.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Quote not found" };

  await db().quote.update({ where: { id }, data: { status } });
  await db().auditLog.create({
    data: { adminUserId, action: "quote.status_changed", entityType: "quote", entityId: id, before: { status: existing.status }, after: { status } },
  });
  return { ok: true };
}

export async function duplicateQuote(id: string): Promise<{ id: string } | null> {
  const existing = await db().quote.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return null;
  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId: existing.leadId,
      subtotal: existing.subtotal,
      discount: existing.discount,
      discountType: existing.discountType,
      discountValue: existing.discountValue,
      tax: existing.tax,
      deposit: existing.deposit,
      depositType: existing.depositType,
      depositValue: existing.depositValue,
      total: existing.total,
      notes: existing.notes,
      internalNotes: existing.internalNotes,
      scopeOfService: existing.scopeOfService,
      exclusions: existing.exclusions,
      customerMessage: existing.customerMessage,
      items: {
        create: existing.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, pricingUnit: i.pricingUnit, frequency: i.frequency, customFrequency: i.customFrequency })),
      },
    },
  });
  return { id: quote.id };
}

export interface CreateRevisionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Commercial quotes get negotiated. A revision is a brand-new Quote row (fresh id, same
 * quoteNumber, revisionNumber+1, revisedFromId pointing at the quote it was copied from) landing
 * DRAFT so it can be freely edited -- the ORIGINAL is left completely untouched (its status,
 * numbers, and history stay exactly as the customer saw them). Only allowed once a quote has
 * actually been sent (DRAFT has no need to "revise" -- just keep editing it); not allowed on an
 * ACCEPTED quote, which needs a real contract-amendment conversation, not a quiet swap.
 */
export async function createRevision(id: string, adminUserId: string): Promise<CreateRevisionResult> {
  const existing = await db().quote.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return { ok: false, error: "Quote not found" };
  if (existing.status === "DRAFT") return { ok: false, error: "A draft doesn't need a revision -- just keep editing it." };
  if (existing.status === "ACCEPTED") return { ok: false, error: "This quote has already been accepted. Revising it would silently change a confirmed agreement." };

  // quoteNumber has a real DB @unique constraint (confirmed the hard way -- an earlier version of
  // this function tried to literally reuse the original's quoteNumber and failed with a real
  // P2002 unique-constraint violation), so a revision keeps the same BASE number with a "-R2"/"-R3"
  // suffix -- still visually groups every revision of one negotiation together, while satisfying
  // the real uniqueness requirement. revisionNumber is the structured field everything else (the
  // UI's "Revision N" label, this own function's own numbering) actually reads.
  const baseQuoteNumber = existing.quoteNumber.replace(/-R\d+$/, "");
  const quote = await db().quote.create({
    data: {
      quoteNumber: `${baseQuoteNumber}-R${existing.revisionNumber + 1}`,
      leadId: existing.leadId,
      status: "DRAFT",
      subtotal: existing.subtotal,
      discount: existing.discount,
      discountType: existing.discountType,
      discountValue: existing.discountValue,
      tax: existing.tax,
      deposit: existing.deposit,
      depositType: existing.depositType,
      depositValue: existing.depositValue,
      total: existing.total,
      notes: existing.notes,
      internalNotes: existing.internalNotes,
      scopeOfService: existing.scopeOfService,
      exclusions: existing.exclusions,
      customerMessage: existing.customerMessage,
      revisionNumber: existing.revisionNumber + 1,
      revisedFromId: existing.id,
      items: {
        create: existing.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, pricingUnit: i.pricingUnit, frequency: i.frequency, customFrequency: i.customFrequency })),
      },
    },
  });
  await db().auditLog.create({
    data: { adminUserId, action: "quote.revised", entityType: "quote", entityId: quote.id, before: { revisedFromId: existing.id }, after: { revisionNumber: quote.revisionNumber } },
  });
  return { ok: true, id: quote.id };
}

export interface DeleteQuoteResult { ok: boolean; error?: string }

export async function deleteQuote(id: string): Promise<DeleteQuoteResult> {
  const existing = await db().quote.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Not found" };

  // Real payments recorded via the admin "Record payment" flow (recordPayment in paymentStore.ts)
  // only ever set Payment.bookingId/customerId, never quoteId -- so this has to check through the
  // quote's bookings, not payment.quoteId directly (which nothing in the app actually populates),
  // matching how deleteLead's equivalent guard already does it.
  const paidPayment = await db().payment.findFirst({ where: { status: "PAID", OR: [{ quoteId: id }, { booking: { quoteId: id } }] } });
  if (paidPayment) {
    return { ok: false, error: "This quote has a real payment on file and can't be deleted. Void the related invoice instead if it needs to be corrected." };
  }

  await db().quote.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
