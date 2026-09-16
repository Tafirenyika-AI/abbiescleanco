import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Expenses require DATABASE_URL to be configured.");
  return prisma;
}

export const EXPENSE_CATEGORIES = [
  "CLEANING_SUPPLIES",
  "TRANSPORTATION",
  "EQUIPMENT",
  "ADVERTISING",
  "SOFTWARE",
  "INSURANCE",
  "PAYROLL",
  "OTHER",
] as const;
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategoryLabels: Record<ExpenseCategoryValue, string> = {
  CLEANING_SUPPLIES: "Cleaning supplies",
  TRANSPORTATION: "Transportation",
  EQUIPMENT: "Equipment",
  ADVERTISING: "Advertising",
  SOFTWARE: "Software",
  INSURANCE: "Insurance",
  PAYROLL: "Payroll",
  OTHER: "Other",
};

export interface ExpenseItem {
  id: string;
  category: ExpenseCategoryValue;
  vendor: string | null;
  amount: number; // cents
  date: string;
  description: string | null;
  paymentMethod: string | null;
  isTaxDeductible: boolean;
  receiptUrl: string | null;
}

export async function listExpenses(): Promise<ExpenseItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const expenses = await prisma.expense.findMany({ where: { deletedAt: null }, orderBy: { date: "desc" }, take: 300 });
  return expenses.map((e) => ({
    id: e.id,
    category: e.category,
    vendor: e.vendor,
    amount: e.amount,
    date: e.date.toISOString(),
    description: e.description,
    paymentMethod: e.paymentMethod,
    isTaxDeductible: e.isTaxDeductible,
    receiptUrl: e.receiptUrl,
  }));
}

export async function createExpense(data: {
  category: ExpenseCategoryValue;
  vendor?: string;
  amount: number;
  date: string;
  description?: string;
  paymentMethod?: string;
  isTaxDeductible?: boolean;
  receiptUrl?: string;
}) {
  return db().expense.create({
    data: {
      category: data.category,
      vendor: data.vendor,
      amount: data.amount,
      date: new Date(data.date),
      description: data.description,
      paymentMethod: data.paymentMethod,
      isTaxDeductible: data.isTaxDeductible ?? true,
      receiptUrl: data.receiptUrl,
    },
  });
}

export async function deleteExpense(id: string): Promise<boolean> {
  const existing = await db().expense.findUnique({ where: { id } });
  if (!existing) return false;
  await db().expense.update({ where: { id }, data: { deletedAt: new Date() } });
  return true;
}
