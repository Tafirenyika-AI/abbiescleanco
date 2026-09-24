import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Finance overview aggregation -- extends reportsStore.ts's existing query pattern (parallel
 * Prisma queries per date range, deletedAt-filtered) rather than a parallel system. No new
 * "finance_transactions" ledger table: money in/out is read live from Payment + Expense, which
 * are already the real source of truth, per the module's own "don't duplicate data" instruction.
 *
 * "Subcontractor owed" is deliberately always 0 with an honest note -- there is no subcontractor
 * data model yet (Workforce is a Coming-Soon module), so a real number can't be computed. Never
 * fabricated.
 */

function rangeFor(range: "today" | "month" | "year"): { start: Date; end: Date } {
  const now = new Date();
  const end = now;
  let start: Date;
  if (range === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }
  return { start, end };
}

export interface FinanceOverview {
  range: "today" | "month" | "year";
  rangeStart: string;
  rangeEnd: string;
  revenue: number; // cents -- value of quotes accepted in the window (accrual)
  collected: number; // cents -- real PAID payments minus refunds, in the window (cash)
  expenses: number; // cents
  estimatedProfit: number; // cents -- collected minus expenses (cash-basis)
  outstandingInvoices: number; // cents -- balance due on all non-cancelled invoices, regardless of window
  subcontractorOwed: null; // always null -- no subcontractor data model exists yet
}

export async function getFinanceOverview(range: "today" | "month" | "year"): Promise<FinanceOverview> {
  const { start, end } = rangeFor(range);
  const empty: FinanceOverview = {
    range, rangeStart: start.toISOString(), rangeEnd: end.toISOString(),
    revenue: 0, collected: 0, expenses: 0, estimatedProfit: 0, outstandingInvoices: 0, subcontractorOwed: null,
  };
  if (!isDatabaseConfigured || !prisma) return empty;

  const [acceptedQuotes, paidPayments, expenses, openInvoices] = await Promise.all([
    prisma.quote.findMany({ where: { status: "ACCEPTED", createdAt: { gte: start, lte: end }, deletedAt: null }, select: { total: true } }),
    prisma.payment.findMany({ where: { status: "PAID", createdAt: { gte: start, lte: end } }, select: { amount: true, refundAmount: true } }),
    prisma.expense.findMany({ where: { date: { gte: start, lte: end }, deletedAt: null }, select: { amount: true } }),
    // Outstanding balance is a point-in-time fact, not scoped to the range -- an invoice from last
    // month that's still unpaid is still owed today.
    prisma.invoice.findMany({ where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } }, include: { quote: { select: { total: true } }, booking: { select: { id: true } } } }),
  ]);

  const revenue = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);
  const collected = paidPayments.reduce((sum, p) => sum + (p.amount - p.refundAmount), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  let outstandingInvoices = 0;
  for (const inv of openInvoices) {
    const paid = inv.booking
      ? await prisma.payment.aggregate({ where: { bookingId: inv.booking.id, status: "PAID" }, _sum: { amount: true, refundAmount: true } })
      : null;
    const net = (paid?._sum.amount ?? 0) - (paid?._sum.refundAmount ?? 0);
    outstandingInvoices += Math.max(0, inv.quote.total - net);
  }

  return {
    range, rangeStart: start.toISOString(), rangeEnd: end.toISOString(),
    revenue, collected, expenses: expensesTotal,
    estimatedProfit: collected - expensesTotal,
    outstandingInvoices,
    subcontractorOwed: null,
  };
}

export interface CategoryAmount { category: string; label: string; cents: number }

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  CLEANING_SUPPLIES: "Cleaning supplies", TRANSPORTATION: "Transportation", EQUIPMENT: "Equipment",
  ADVERTISING: "Advertising", SOFTWARE: "Software", INSURANCE: "Insurance", PAYROLL: "Payroll", OTHER: "Other",
  FUEL: "Fuel", VEHICLE: "Vehicle", SUBCONTRACTORS: "Subcontractors", EMPLOYEE_COSTS: "Employee costs",
  OFFICE: "Office", PHONE: "Phone", PROFESSIONAL_SERVICES: "Professional services", BANK_FEES: "Bank fees",
  PAYMENT_PROCESSING: "Payment processing",
};

export async function getExpensesByCategory(range: "today" | "month" | "year"): Promise<CategoryAmount[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const { start, end } = rangeFor(range);
  const expenses = await prisma.expense.findMany({ where: { date: { gte: start, lte: end }, deletedAt: null }, select: { category: true, amount: true } });
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  return [...byCategory.entries()]
    .map(([category, cents]) => ({ category, label: EXPENSE_CATEGORY_LABELS[category] ?? category, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Revenue by service, from accepted quotes' leads (the service the quote was actually for). */
export async function getRevenueByService(range: "today" | "month" | "year"): Promise<CategoryAmount[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const { start, end } = rangeFor(range);
  const quotes = await prisma.quote.findMany({
    where: { status: "ACCEPTED", createdAt: { gte: start, lte: end }, deletedAt: null },
    include: { lead: { include: { service: { select: { name: true } } } } },
  });
  const byService = new Map<string, number>();
  for (const q of quotes) {
    const name = q.lead.service.name;
    byService.set(name, (byService.get(name) ?? 0) + q.total);
  }
  return [...byService.entries()].map(([category, cents]) => ({ category, label: category, cents })).sort((a, b) => b.cents - a.cents);
}

/** Revenue by city, from accepted quotes whose lead has a real address on file. */
export async function getRevenueByCity(range: "today" | "month" | "year"): Promise<CategoryAmount[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const { start, end } = rangeFor(range);
  const quotes = await prisma.quote.findMany({
    where: { status: "ACCEPTED", createdAt: { gte: start, lte: end }, deletedAt: null },
    include: { lead: { include: { address: { select: { city: true } } } } },
  });
  const byCity = new Map<string, number>();
  for (const q of quotes) {
    const city = q.lead.address?.city;
    if (!city) continue;
    byCity.set(city, (byCity.get(city) ?? 0) + q.total);
  }
  return [...byCity.entries()].map(([category, cents]) => ({ category, label: category, cents })).sort((a, b) => b.cents - a.cents);
}

/** Real collected payments (PAID, net of refunds) and real expenses, bucketed per day -- extends reportsStore.ts's getDailyRevenue with an expense series for a revenue-vs-expenses chart. */
export async function getRevenueVsExpensesTrend(days: number): Promise<{ date: string; revenueCents: number; expenseCents: number }[]> {
  const out: { date: string; revenueCents: number; expenseCents: number }[] = [];
  if (!isDatabaseConfigured || !prisma) return out;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { status: "PAID", createdAt: { gte: start } }, select: { amount: true, refundAmount: true, createdAt: true } }),
    prisma.expense.findMany({ where: { date: { gte: start }, deletedAt: null }, select: { amount: true, date: true } }),
  ]);

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const revenueCents = payments.filter((p) => p.createdAt >= dayStart && p.createdAt <= dayEnd).reduce((sum, p) => sum + (p.amount - p.refundAmount), 0);
    const expenseCents = expenses.filter((e) => e.date >= dayStart && e.date <= dayEnd).reduce((sum, e) => sum + e.amount, 0);
    out.push({ date: dayStart.toISOString().slice(0, 10), revenueCents, expenseCents });
  }
  return out;
}
