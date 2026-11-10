import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getInvoiceById, deleteInvoiceForGood } from "@/lib/server/invoiceStore";
import { listPaymentLinksForInvoice } from "@/lib/server/invoicePaymentLinkStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_VIEW");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const paymentLinks = await listPaymentLinksForInvoice(id);
  return NextResponse.json({ ok: true, invoice: { ...invoice, paymentLinks } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteInvoiceForGood(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
