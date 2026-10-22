import { prisma, isDatabaseConfigured } from "@/lib/db";
import { SUBCONTRACTOR_PAY_TYPES, SUBCONTRACTOR_STATUSES, type SubcontractorPayType, type SubcontractorStatusValue, type SubcontractorRow, type PayablesJob, type SubcontractorPayables, type WorkforceSubcontractorRow } from "@/lib/subcontractors";

export {
  SUBCONTRACTOR_PAY_TYPES, subcontractorPayTypeLabels, SUBCONTRACTOR_STATUSES,
  type SubcontractorPayType, type SubcontractorStatusValue, type SubcontractorRow, type PayablesJob, type SubcontractorPayables, type WorkforceSubcontractorRow,
} from "@/lib/subcontractors";

/**
 * Real Subcontractor/independent-cleaner entity -- the thing Booking.staffAssignee's own comment
 * called "a free-text placeholder until staff accounts exist." Payables (what's owed) are computed
 * live from real COMPLETED bookings assigned to a subcontractor and real Expense payouts already
 * recorded against them (category SUBCONTRACTORS) -- no separate payout ledger table, same
 * "don't duplicate data already stored elsewhere" rule the rest of Finance follows.
 */

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  return prisma;
}

function mapRow(s: {
  id: string; name: string; email: string | null; phone: string | null; payType: string;
  payRateCents: number; payRatePercent: number | null; taxIdLast4: string | null; status: string;
  notes: string | null; createdAt: Date; updatedAt: Date;
}): SubcontractorRow {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    payType: (SUBCONTRACTOR_PAY_TYPES as readonly string[]).includes(s.payType) ? (s.payType as SubcontractorPayType) : "PER_JOB",
    payRateCents: s.payRateCents,
    payRatePercent: s.payRatePercent,
    taxIdLast4: s.taxIdLast4,
    status: (SUBCONTRACTOR_STATUSES as readonly string[]).includes(s.status) ? (s.status as SubcontractorStatusValue) : "ACTIVE",
    notes: s.notes,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSubcontractors(): Promise<SubcontractorRow[]> {
  const rows = await db().subcontractor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  return rows.map(mapRow);
}

export interface AssignableSubcontractor {
  id: string;
  name: string;
}

/** A trimmed, read-only view for the booking-assignment dropdown -- callers there only have
 *  MANAGE_BOOKINGS, not the fuller FINANCE_SUBCONTRACTORS a real roster/payables view needs,
 *  same reasoning as prospectStore's listAssignableAdmins. */
export async function listAssignableSubcontractors(): Promise<AssignableSubcontractor[]> {
  const rows = await db().subcontractor.findMany({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return rows;
}

export async function getSubcontractorById(id: string): Promise<SubcontractorRow | null> {
  const row = await db().subcontractor.findFirst({ where: { id, deletedAt: null } });
  return row ? mapRow(row) : null;
}

interface SubcontractorIdCountRow { id: string; total: bigint; completed: bigint }

/** Trimmed, non-financial roster for the Workforce page -- see WorkforceSubcontractorRow's own
 *  comment for why pay rate/tax id are deliberately left out. Job counts come from the real
 *  subcontractorId FK (no legacy name-matching needed here, unlike TeamMember -- this FK has
 *  existed since Subcontractor itself was introduced). */
export async function listSubcontractorsForWorkforce(): Promise<WorkforceSubcontractorRow[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const [rows, counts] = await Promise.all([
    prisma.subcontractor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.$queryRaw<SubcontractorIdCountRow[]>`
      SELECT "subcontractorId" AS id,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
      FROM bookings
      WHERE "deletedAt" IS NULL AND "subcontractorId" IS NOT NULL
      GROUP BY "subcontractorId"
    `,
  ]);
  const countsById = new Map(counts.map((c) => [c.id, c]));
  return rows.map((s) => {
    const c = countsById.get(s.id);
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      payType: (SUBCONTRACTOR_PAY_TYPES as readonly string[]).includes(s.payType) ? (s.payType as SubcontractorPayType) : "PER_JOB",
      status: (SUBCONTRACTOR_STATUSES as readonly string[]).includes(s.status) ? (s.status as SubcontractorStatusValue) : "ACTIVE",
      assignedJobs: Number(c?.total ?? 0),
      completedJobs: Number(c?.completed ?? 0),
    };
  });
}

export interface SaveSubcontractorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  payType: SubcontractorPayType;
  payRateCents?: number;
  payRatePercent?: number | null;
  taxIdLast4?: string | null;
  status?: SubcontractorStatusValue;
  notes?: string | null;
}

export async function createSubcontractor(input: SaveSubcontractorInput): Promise<SubcontractorRow> {
  const row = await db().subcontractor.create({
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      payType: input.payType,
      payRateCents: input.payRateCents ?? 0,
      payRatePercent: input.payRatePercent ?? null,
      taxIdLast4: input.taxIdLast4 || null,
      status: input.status ?? "ACTIVE",
      notes: input.notes || null,
    },
  });
  return mapRow(row);
}

export async function updateSubcontractor(id: string, input: Partial<SaveSubcontractorInput>): Promise<SubcontractorRow | null> {
  const existing = await db().subcontractor.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;
  const row = await db().subcontractor.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.payType !== undefined ? { payType: input.payType } : {}),
      ...(input.payRateCents !== undefined ? { payRateCents: input.payRateCents } : {}),
      ...(input.payRatePercent !== undefined ? { payRatePercent: input.payRatePercent } : {}),
      ...(input.taxIdLast4 !== undefined ? { taxIdLast4: input.taxIdLast4 || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    },
  });
  // A name change should show up on every booking display that reads the free-text
  // staffAssignee too, not just new assignments -- keep every currently-linked booking in sync.
  if (input.name !== undefined && input.name !== existing.name) {
    await db().booking.updateMany({ where: { subcontractorId: id }, data: { staffAssignee: input.name } });
  }
  return mapRow(row);
}

export async function deleteSubcontractor(id: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().subcontractor.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return { ok: false, error: "Not found" };
  await db().subcontractor.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } });
  return { ok: true };
}

/** Links a real booking to a real subcontractor, or clears it (pass null). Keeps the existing
 *  free-text staffAssignee field in sync so every calendar/list view that already reads it keeps
 *  working unchanged -- see the schema's own comment on Booking.staffAssignee. */
export async function assignBookingToSubcontractor(bookingId: string, subcontractorId: string | null): Promise<{ ok: boolean; error?: string }> {
  const booking = await db().booking.findFirst({ where: { id: bookingId, deletedAt: null } });
  if (!booking) return { ok: false, error: "Booking not found" };

  if (subcontractorId === null) {
    await db().booking.update({ where: { id: bookingId }, data: { subcontractorId: null } });
    return { ok: true };
  }
  const subcontractor = await db().subcontractor.findFirst({ where: { id: subcontractorId, deletedAt: null } });
  if (!subcontractor) return { ok: false, error: "Subcontractor not found" };
  await db().booking.update({ where: { id: bookingId }, data: { subcontractorId, staffAssignee: subcontractor.name } });
  return { ok: true };
}

/**
 * Real, computed-live payables for one subcontractor -- never a stored/cached balance, so it's
 * always consistent with the real Booking/Expense data it's built from. PERCENTAGE needs the
 * booking's linked Quote; HOURLY needs real actualStart/actualEnd (falls back to
 * scheduledStart/End only when actual times were never recorded). FLAT_MONTHLY isn't tied to
 * individual jobs at all -- the admin just logs real payouts directly against the subcontractor,
 * and this returns autoCalculated: false rather than inventing a figure.
 */
export async function getSubcontractorPayables(subcontractorId: string): Promise<SubcontractorPayables | null> {
  const subcontractor = await db().subcontractor.findFirst({ where: { id: subcontractorId, deletedAt: null } });
  if (!subcontractor) return null;

  const [completedBookings, paidExpenses] = await Promise.all([
    db().booking.findMany({
      where: { subcontractorId, status: "COMPLETED", deletedAt: null },
      include: { quote: { select: { total: true } } },
      orderBy: { scheduledStart: "desc" },
    }),
    db().expense.aggregate({
      where: { subcontractorId, category: "SUBCONTRACTORS", deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const payType = (SUBCONTRACTOR_PAY_TYPES as readonly string[]).includes(subcontractor.payType) ? (subcontractor.payType as SubcontractorPayType) : "PER_JOB";
  const paidCents = paidExpenses._sum.amount ?? 0;

  if (payType === "FLAT_MONTHLY") {
    return {
      payType, completedJobsCount: completedBookings.length, earnedCents: 0, uncomputableJobsCount: 0,
      paidCents, owedCents: -paidCents, jobs: [], autoCalculated: false,
    };
  }

  const jobs: PayablesJob[] = completedBookings.map((b) => {
    let earnedCents: number | null = null;
    let reason: string | null = null;
    if (payType === "PER_JOB") {
      earnedCents = subcontractor.payRateCents;
    } else if (payType === "HOURLY") {
      const start = b.actualStart ?? b.scheduledStart;
      const end = b.actualEnd ?? b.scheduledEnd;
      if (start && end && end > start) {
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        earnedCents = Math.round(subcontractor.payRateCents * hours);
      } else {
        reason = "No start/end time recorded for this job";
      }
    } else if (payType === "PERCENTAGE") {
      if (b.quote && subcontractor.payRatePercent) {
        earnedCents = Math.round((b.quote.total * subcontractor.payRatePercent) / 100);
      } else {
        reason = b.quote ? "No percentage rate set on this subcontractor" : "No quote linked to this job";
      }
    }
    return {
      bookingId: b.id,
      reference: b.reference,
      completedDate: (b.actualEnd ?? b.scheduledEnd)?.toISOString() ?? null,
      earnedCents,
      reason,
    };
  });

  const earnedCents = jobs.reduce((sum, j) => sum + (j.earnedCents ?? 0), 0);
  const uncomputableJobsCount = jobs.filter((j) => j.earnedCents === null).length;

  return {
    payType, completedJobsCount: completedBookings.length, earnedCents, uncomputableJobsCount,
    paidCents, owedCents: earnedCents - paidCents, jobs, autoCalculated: true,
  };
}

/** Point-in-time total owed across every active subcontractor right now -- not scoped to a date
 *  range, same reasoning as financeStore's computeOutstandingInvoices. Only sums types that can
 *  actually be computed; FLAT_MONTHLY subcontractors are excluded (there's no real figure to add),
 *  same honesty rule as everywhere else in Finance -- never a fabricated number. */
export async function computeSubcontractorOwed(): Promise<number> {
  if (!isDatabaseConfigured || !prisma) return 0;
  const active = await prisma.subcontractor.findMany({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
  let total = 0;
  for (const s of active) {
    const payables = await getSubcontractorPayables(s.id);
    if (payables?.autoCalculated) total += Math.max(0, payables.owedCents);
  }
  return total;
}

export interface RecordPayoutInput {
  amountCents: number;
  date: string;
  note?: string;
}

/** Records a real payout as an Expense (category SUBCONTRACTORS) -- the one source of truth for
 *  "what's actually been paid," same as every other real cost in Finance. */
export async function recordSubcontractorPayout(subcontractorId: string, input: RecordPayoutInput): Promise<{ ok: boolean; error?: string }> {
  const subcontractor = await db().subcontractor.findFirst({ where: { id: subcontractorId, deletedAt: null } });
  if (!subcontractor) return { ok: false, error: "Subcontractor not found" };
  await db().expense.create({
    data: {
      category: "SUBCONTRACTORS",
      vendor: subcontractor.name,
      amount: input.amountCents,
      date: new Date(input.date),
      description: input.note || `Payout to ${subcontractor.name}`,
      subcontractorId,
    },
  });
  return { ok: true };
}

export interface YearlyPayoutTotal {
  subcontractorId: string;
  name: string;
  totalCents: number;
  requires1099: boolean; // real US 1099-NEC threshold ($600/year) -- informational only, not tax advice
}

/** Real per-subcontractor payout totals for a calendar year, for 1099 recordkeeping -- see
 *  taxStore.ts, which surfaces this on the Tax Records page. */
export async function getYearlyPayoutTotals(year: number): Promise<YearlyPayoutTotal[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const expenses = await prisma.expense.findMany({
    where: { category: "SUBCONTRACTORS", subcontractorId: { not: null }, date: { gte: start, lt: end }, deletedAt: null },
    select: { subcontractorId: true, amount: true },
  });
  const subcontractors = await prisma.subcontractor.findMany({ select: { id: true, name: true } });
  const nameById = new Map(subcontractors.map((s) => [s.id, s.name]));

  const byId = new Map<string, number>();
  for (const e of expenses) {
    if (!e.subcontractorId) continue;
    byId.set(e.subcontractorId, (byId.get(e.subcontractorId) ?? 0) + e.amount);
  }
  return [...byId.entries()]
    .map(([subcontractorId, totalCents]) => ({
      subcontractorId,
      name: nameById.get(subcontractorId) ?? "(removed subcontractor)",
      totalCents,
      requires1099: totalCents >= 60000, // $600.00
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
