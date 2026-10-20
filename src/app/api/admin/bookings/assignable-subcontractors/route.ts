import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listAssignableSubcontractors } from "@/lib/server/subcontractorStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const subcontractors = await listAssignableSubcontractors();
  return NextResponse.json({ ok: true, subcontractors });
}
