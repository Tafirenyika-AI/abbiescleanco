import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { recordRefund } from "@/lib/server/paymentStore";

const schema = z.object({
  amount: z.coerce.number().int().min(1), // cents
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_REFUNDS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const result = await recordRefund(id, parsed.data.amount, parsed.data.reason, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
