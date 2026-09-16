import { prisma, isDatabaseConfigured } from "@/lib/db";
import { generateReference } from "@/lib/reference";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Quotes require DATABASE_URL to be configured.");
  return prisma;
}

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"] as const;
export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

export interface QuoteItemInput {
  label: string;
  quantity: number;
  unitPrice: number; // cents
}

export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  status: QuoteStatusValue;
  total: number;
  deposit: number;
  createdAt: string;
  expiresAt: string | null;
  customerName: string;
  serviceName: string;
  leadId: string;
}

function computeTotals(items: QuoteItemInput[], discount: number, tax: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const total = Math.max(0, subtotal - discount + tax);
  return { subtotal, total };
}

export async function listQuotes(): Promise<QuoteListItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const quotes = await prisma.quote.findMany({
    where: { deletedAt: null },
    include: { lead: { include: { customer: true, service: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return quotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    total: q.total,
    deposit: q.deposit,
    createdAt: q.createdAt.toISOString(),
    expiresAt: q.expiresAt?.toISOString() ?? null,
    customerName: q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "—",
    serviceName: q.lead.service.name,
    leadId: q.leadId,
  }));
}

export interface QuoteDetail {
  id: string;
  quoteNumber: string;
  status: QuoteStatusValue;
  subtotal: number;
  discount: number;
  tax: number;
  deposit: number;
  total: number;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  leadId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  items: { id: string; label: string; quantity: number; unitPrice: number; total: number }[];
}

export async function getQuoteById(id: string): Promise<QuoteDetail | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const q = await prisma.quote.findFirst({
    where: { id, deletedAt: null },
    include: { lead: { include: { customer: true, service: true } }, items: true },
  });
  if (!q) return null;
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    deposit: q.deposit,
    total: q.total,
    expiresAt: q.expiresAt?.toISOString() ?? null,
    notes: q.notes,
    createdAt: q.createdAt.toISOString(),
    leadId: q.leadId,
    customerName: q.lead.customer ? `${q.lead.customer.firstName} ${q.lead.customer.lastName}`.trim() : "—",
    customerEmail: q.lead.customer?.email ?? "",
    customerPhone: q.lead.customer?.phone ?? "",
    serviceName: q.lead.service.name,
    items: q.items.map((i) => ({ id: i.id, label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
  };
}

export async function createQuote(
  leadId: string,
  data: { items: QuoteItemInput[]; discount?: number; tax?: number; deposit?: number; expiresAt?: string; notes?: string }
): Promise<{ id: string }> {
  const { subtotal, total } = computeTotals(data.items, data.discount ?? 0, data.tax ?? 0);
  const quote = await db().quote.create({
    data: {
      quoteNumber: generateReference("Q"),
      leadId,
      subtotal,
      discount: data.discount ?? 0,
      tax: data.tax ?? 0,
      deposit: data.deposit ?? 0,
      total,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes,
      items: {
        create: data.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice })),
      },
    },
  });
  return { id: quote.id };
}

/** Only DRAFT quotes can have their terms edited — once sent, the numbers a customer saw are frozen. */
export async function updateDraftQuote(
  id: string,
  data: { items: QuoteItemInput[]; discount?: number; tax?: number; deposit?: number; expiresAt?: string; notes?: string }
): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().quote.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Quote not found" };
  if (existing.status !== "DRAFT") return { ok: false, error: "Only draft quotes can be edited. Duplicate it to make changes." };

  const { subtotal, total } = computeTotals(data.items, data.discount ?? 0, data.tax ?? 0);
  await db().quoteItem.deleteMany({ where: { quoteId: id } });
  await db().quote.update({
    where: { id },
    data: {
      subtotal,
      discount: data.discount ?? 0,
      tax: data.tax ?? 0,
      deposit: data.deposit ?? 0,
      total,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes,
      items: { create: data.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice })) },
    },
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
      tax: existing.tax,
      deposit: existing.deposit,
      total: existing.total,
      notes: existing.notes,
      items: { create: existing.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })) },
    },
  });
  return { id: quote.id };
}

export async function deleteQuote(id: string): Promise<boolean> {
  const existing = await db().quote.findUnique({ where: { id } });
  if (!existing) return false;
  await db().quote.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
}
