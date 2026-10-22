import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listAssignableTeamMembers } from "@/lib/server/teamStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const teamMembers = await listAssignableTeamMembers();
  return NextResponse.json({ ok: true, teamMembers });
}
