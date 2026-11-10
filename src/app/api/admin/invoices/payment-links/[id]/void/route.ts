import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { voidPaymentLink } from "@/lib/server/invoicePaymentLinkStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await voidPaymentLink(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
