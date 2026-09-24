import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deleteConnection } from "@/lib/server/marketingConnections";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteConnection(id, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
