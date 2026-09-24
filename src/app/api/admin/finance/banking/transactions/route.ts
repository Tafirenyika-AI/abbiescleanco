import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listBankTransactions } from "@/lib/server/bankStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_VIEW");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const filter = status === "unmatched" || status === "matched" || status === "ignored" ? status : "all";
  const transactions = await listBankTransactions(filter);
  return NextResponse.json({ ok: true, transactions });
}
