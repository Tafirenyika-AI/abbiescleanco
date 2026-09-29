import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateLeadStatus, deleteLead, LEAD_STATUSES } from "@/lib/server/leadStore";

const bulkSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    status: z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.status !== "LOST" || !!data.lostReason?.trim(), {
    message: "A reason is required when marking leads as lost.",
    path: ["lostReason"],
  });

const deleteSchema = z.object({ ids: z.array(z.string().trim().min(1)).min(1).max(200) });

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const results = await Promise.all(
    parsed.data.ids.map((id) => updateLeadStatus(id, { status: parsed.data.status, lostReason: parsed.data.lostReason }, admin.id))
  );
  const updated = results.filter(Boolean).length;
  return NextResponse.json({ ok: true, updated });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "No items selected" }, { status: 400 });

  const results = await Promise.all(parsed.data.ids.map((id) => deleteLead(id, admin.id)));
  const deleted = results.filter((r) => r.ok).length;
  // A lead with a real payment on file is deliberately not deletable (see deleteLead) -- surfaced
  // distinctly so a partial batch doesn't look like it silently did nothing for those rows.
  const blocked = results.filter((r) => !r.ok && r.error?.includes("real payment")).length;
  return NextResponse.json({ ok: true, deleted, blocked, notFound: parsed.data.ids.length - deleted - blocked });
}
