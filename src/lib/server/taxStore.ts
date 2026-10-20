import { prisma, isDatabaseConfigured } from "@/lib/db";
import { expenseCategoryLabels, type ExpenseCategoryValue } from "@/lib/server/expenseStore";
import { getYearlyPayoutTotals, type YearlyPayoutTotal } from "@/lib/server/subcontractorStore";

export { type YearlyPayoutTotal } from "@/lib/server/subcontractorStore";

/**
 * Tax recordkeeping -- real numbers only, aggregated live from the same Payment/Expense data the
 * rest of Finance already uses (same "don't duplicate data" rule, no parallel ledger). This is
 * NOT a tax calculator: it never computes an actual tax liability (that depends on the business's
 * real legal structure/deductions, which this app has no way to know), only real revenue/expense
 * totals and the real $600 1099-NEC payout threshold -- both plainly labeled, neither is tax advice.
 */

export interface TaxCategoryAmount {
  category: ExpenseCategoryValue;
  label: string;
  cents: number;
}

export interface TaxYearSummary {
  year: number;
  revenueCents: number; // real collected payments (cash basis), net of refunds, for the calendar year
  deductibleExpensesCents: number;
  nonDeductibleExpensesCents: number; // shown separately, honestly -- never folded into the deductible total
  expensesByCategory: TaxCategoryAmount[];
  netEstimateCents: number; // revenueCents - deductibleExpensesCents -- a real arithmetic fact, not a tax liability
  subcontractorPayouts: YearlyPayoutTotal[];
}

function yearBounds(year: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

export async function getTaxYearSummary(year: number): Promise<TaxYearSummary> {
  const empty: TaxYearSummary = {
    year, revenueCents: 0, deductibleExpensesCents: 0, nonDeductibleExpensesCents: 0,
    expensesByCategory: [], netEstimateCents: 0, subcontractorPayouts: [],
  };
  if (!isDatabaseConfigured || !prisma) return empty;

  const { start, end } = yearBounds(year);
  const [payments, expenses, subcontractorPayouts] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PAID", createdAt: { gte: start, lt: end }, OR: [{ bookingId: null }, { booking: { deletedAt: null } }] },
      select: { amount: true, refundAmount: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: start, lt: end }, deletedAt: null }, select: { category: true, amount: true, isTaxDeductible: true } }),
    getYearlyPayoutTotals(year),
  ]);

  const revenueCents = payments.reduce((sum, p) => sum + (p.amount - p.refundAmount), 0);
  const deductible = expenses.filter((e) => e.isTaxDeductible);
  const nonDeductible = expenses.filter((e) => !e.isTaxDeductible);
  const deductibleExpensesCents = deductible.reduce((sum, e) => sum + e.amount, 0);
  const nonDeductibleExpensesCents = nonDeductible.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of deductible) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  const expensesByCategory = [...byCategory.entries()]
    .map(([category, cents]) => ({ category: category as ExpenseCategoryValue, label: expenseCategoryLabels[category as ExpenseCategoryValue] ?? category, cents }))
    .sort((a, b) => b.cents - a.cents);

  return {
    year, revenueCents, deductibleExpensesCents, nonDeductibleExpensesCents, expensesByCategory,
    netEstimateCents: revenueCents - deductibleExpensesCents,
    subcontractorPayouts,
  };
}

/** Real years that have at least one real payment or expense -- so the year selector only ever
 *  offers years with something to actually show, never an empty year as if it were real data. */
export async function getAvailableTaxYears(): Promise<number[]> {
  if (!isDatabaseConfigured || !prisma) return [new Date().getFullYear()];
  const [firstPayment, firstExpense] = await Promise.all([
    prisma.payment.findFirst({ where: { status: "PAID" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.expense.findFirst({ where: { deletedAt: null }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);
  const earliestYear = Math.min(
    firstPayment?.createdAt.getUTCFullYear() ?? new Date().getFullYear(),
    firstExpense?.date.getUTCFullYear() ?? new Date().getFullYear()
  );
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= earliestYear; y--) years.push(y);
  return years;
}
