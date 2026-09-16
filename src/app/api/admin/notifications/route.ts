import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listAdminNotifications, countUnreadNotifications } from "@/lib/server/notificationStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([listAdminNotifications(), countUnreadNotifications()]);
  return NextResponse.json({ ok: true, notifications, unreadCount });
}
