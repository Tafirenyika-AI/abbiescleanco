import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deleteExpense } from "@/lib/server/expenseStore";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_EXPENSES");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const success = await deleteExpense(id);
  if (!success) return NextResponse.json({ ok: false, error: "Expense not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
