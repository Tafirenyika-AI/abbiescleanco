import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSubcontractorById, updateSubcontractor, deleteSubcontractor, getSubcontractorPayables, SUBCONTRACTOR_PAY_TYPES, SUBCONTRACTOR_STATUSES } from "@/lib/server/subcontractorStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_SUBCONTRACTORS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const subcontractor = await getSubcontractorById(id);
  if (!subcontractor) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const payables = await getSubcontractorPayables(id);
  return NextResponse.json({ ok: true, subcontractor, payables });
}

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().max(200).nullable().optional().refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email"),
  phone: z.string().trim().max(30).nullable().optional(),
  payType: z.enum(SUBCONTRACTOR_PAY_TYPES).optional(),
  payRateCents: z.coerce.number().int().min(0).optional(),
  payRatePercent: z.coerce.number().int().min(1).max(100).nullable().optional(),
  taxIdLast4: z.string().trim().regex(/^\d{4}$/, "Must be exactly 4 digits").nullable().optional().or(z.literal("")),
  status: z.enum(SUBCONTRACTOR_STATUSES).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_SUBCONTRACTORS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const { id } = await params;
  const subcontractor = await updateSubcontractor(id, parsed.data);
  if (!subcontractor) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, subcontractor });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_SUBCONTRACTORS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteSubcontractor(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
