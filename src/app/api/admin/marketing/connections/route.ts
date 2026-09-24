import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listConnections } from "@/lib/server/marketingConnections";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const connections = await listConnections();
  return NextResponse.json({ ok: true, connections });
}
