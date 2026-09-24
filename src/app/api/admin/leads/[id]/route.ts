import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getLeadById, updateLeadStatus, deleteLead, listLeadActivity, LEAD_STATUSES } from "@/lib/server/leadStore";

const updateSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.status !== "LOST" || !!data.lostReason?.trim(), {
    message: "A reason is required when marking a lead as lost.",
    path: ["lostReason"],
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const lead = await getLeadById(id);
  if (!lead) return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  const activity = await listLeadActivity(id);
  return NextResponse.json({ ok: true, lead, activity });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const lead = await updateLeadStatus(id, parsed.data, admin.id);
  if (!lead) return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ ok: true, lead });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await deleteLead(id, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "Not found" ? 404 : 400 });
}
