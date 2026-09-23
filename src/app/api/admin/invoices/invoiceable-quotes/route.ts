import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listInvoiceableQuotes } from "@/lib/server/invoiceStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const quotes = await listInvoiceableQuotes();
  return NextResponse.json({ ok: true, quotes });
}
