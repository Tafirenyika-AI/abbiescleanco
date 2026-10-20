import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { assignStaff } from "@/lib/server/bookingStore";
import { assignBookingToSubcontractor } from "@/lib/server/subcontractorStore";

// subcontractorId set -> pick a real, on-file Subcontractor (its name syncs into staffAssignee
// automatically, see assignBookingToSubcontractor). subcontractorId omitted/null -> plain free
// text, same as before this field existed -- and clears any previously-linked subcontractor,
// since the admin just typed a different name by hand and the two would otherwise go stale.
const schema = z.object({ staffAssignee: z.string().trim().max(100), subcontractorId: z.string().trim().min(1).nullable().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  if (parsed.data.subcontractorId) {
    const result = await assignBookingToSubcontractor(id, parsed.data.subcontractorId);
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  await assignBookingToSubcontractor(id, null);
  await assignStaff(id, parsed.data.staffAssignee);
  return NextResponse.json({ ok: true });
}
