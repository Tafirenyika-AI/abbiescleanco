import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listSubcontractors, createSubcontractor, SUBCONTRACTOR_PAY_TYPES, SUBCONTRACTOR_STATUSES } from "@/lib/server/subcontractorStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_SUBCONTRACTORS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const subcontractors = await listSubcontractors();
  return NextResponse.json({ ok: true, subcontractors });
}

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(200).optional().refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email"),
  phone: z.string().trim().max(30).optional(),
  payType: z.enum(SUBCONTRACTOR_PAY_TYPES),
  payRateCents: z.coerce.number().int().min(0).optional(),
  payRatePercent: z.coerce.number().int().min(1).max(100).optional(),
  taxIdLast4: z.string().trim().regex(/^\d{4}$/, "Must be exactly 4 digits").optional().or(z.literal("")),
  status: z.enum(SUBCONTRACTOR_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_SUBCONTRACTORS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const subcontractor = await createSubcontractor(parsed.data);
  return NextResponse.json({ ok: true, subcontractor });
}
