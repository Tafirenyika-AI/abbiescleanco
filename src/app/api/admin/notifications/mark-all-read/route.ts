import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { markAllNotificationsRead } from "@/lib/server/notificationStore";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  await markAllNotificationsRead();
  return NextResponse.json({ ok: true });
}
