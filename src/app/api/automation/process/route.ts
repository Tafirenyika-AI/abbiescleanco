import { NextRequest, NextResponse } from "next/server";
import { processDueAutomationEvents } from "@/lib/server/automationStore";
import { requireAdmin } from "@/lib/server/requireAdmin";

/**
 * Two ways in: Vercel Cron (Authorization: Bearer CRON_SECRET, set automatically
 * by Vercel when this path is listed in vercel.json's crons) or a logged-in admin
 * clicking "Run now" on /admin/automations — useful since Vercel Hobby cron runs
 * at most once/day, and for testing without waiting on a schedule.
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  return !!admin;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await processDueAutomationEvents();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
