import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listEmailTemplates } from "@/lib/server/emailTemplates";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, templates: await listEmailTemplates() });
}
