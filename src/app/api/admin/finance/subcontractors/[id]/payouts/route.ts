import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { recordSubcontractorPayout } from "@/lib/server/subcontractorStore";

const schema = z.object({
  amountCents: z.coerce.number().int().min(1),
  date: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

/** Records a real payout as an Expense (category SUBCONTRACTORS) -- requires the same permission
 *  that gates recording any other expense, since that's exactly what this is. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_EXPENSES");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { id } = await params;
  const result = await recordSubcontractorPayout(id, parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
