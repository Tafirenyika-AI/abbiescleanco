import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listInvoices, createInvoiceFromQuote } from "@/lib/server/invoiceStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const invoices = await listInvoices();
  return NextResponse.json({ ok: true, invoices });
}

const schema = z.object({
  quoteId: z.string().trim().min(1),
  bookingId: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await createInvoiceFromQuote(parsed.data.quoteId, {
    bookingId: parsed.data.bookingId,
    dueDate: parsed.data.dueDate,
    notes: parsed.data.notes,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
