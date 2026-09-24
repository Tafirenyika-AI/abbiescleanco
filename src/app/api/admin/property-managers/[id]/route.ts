import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getPropertyManagerDetail, setPropertyManagerFlag } from "@/lib/server/propertyManagerStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const detail = await getPropertyManagerDetail(id);
  if (!detail) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, propertyManager: detail });
}

/** Removes the property-manager flag -- never deletes the underlying customer or their history. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await setPropertyManagerFlag(id, false, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
