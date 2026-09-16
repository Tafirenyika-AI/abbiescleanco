import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { duplicateQuote } from "@/lib/server/quoteStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await duplicateQuote(id);
  if (!result) return NextResponse.json({ ok: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: result.id });
}
