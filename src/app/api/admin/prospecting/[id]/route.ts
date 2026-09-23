import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getProspectById, updateProspect, PROSPECT_STATUSES } from "@/lib/server/prospectStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const prospect = await getProspectById(id);
  if (!prospect) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, prospect });
}

const schema = z.object({
  status: z.enum(PROSPECT_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional(),
  draftSubject: z.string().trim().max(200).optional(),
  draftBody: z.string().trim().max(5000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
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
  const prospect = await updateProspect(id, parsed.data);
  if (!prospect) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, prospect });
}
