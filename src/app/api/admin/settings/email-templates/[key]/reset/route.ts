import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { resetEmailTemplate } from "@/lib/server/emailTemplates";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { key } = await params;
  const result = await resetEmailTemplate(key, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
