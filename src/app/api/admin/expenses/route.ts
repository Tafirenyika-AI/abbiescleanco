import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listExpenses, createExpense, EXPENSE_CATEGORIES } from "@/lib/server/expenseStore";

const createSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  vendor: z.string().trim().max(120).optional(),
  amount: z.coerce.number().int().min(1), // cents
  date: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  paymentMethod: z.string().trim().max(30).optional(),
  isTaxDeductible: z.boolean().optional(),
  receiptUrl: z.string().trim().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_VIEW");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const expenses = await listExpenses();
  return NextResponse.json({ ok: true, expenses });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_EXPENSES");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const expense = await createExpense(parsed.data);
  return NextResponse.json({ ok: true, id: expense.id });
}
