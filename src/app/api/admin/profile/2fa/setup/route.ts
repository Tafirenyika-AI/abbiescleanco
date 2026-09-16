import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { startTwoFactorSetup } from "@/lib/server/adminUsers";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (admin.id === "demo-admin") {
    return NextResponse.json({ ok: false, error: "Two-factor authentication requires DATABASE_URL to be configured." }, { status: 503 });
  }

  const result = await startTwoFactorSetup(admin.id);
  if (!result) return NextResponse.json({ ok: false, error: "Couldn't start setup" }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
