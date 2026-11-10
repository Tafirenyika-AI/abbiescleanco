import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { markInvoicePaidManually } from "@/lib/server/invoiceStore";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

const schema = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { id } = await params;
  const result = await markInvoicePaidManually(id, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
