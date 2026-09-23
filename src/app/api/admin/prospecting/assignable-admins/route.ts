import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listAssignableAdmins } from "@/lib/server/prospectStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admins = await listAssignableAdmins();
  return NextResponse.json({ ok: true, admins });
}
