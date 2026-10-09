import { NextRequest, NextResponse } from "next/server";
import { processDueAutomationEvents } from "@/lib/server/automationStore";
import { processTimeTrackingReminders } from "@/lib/server/timeTrackingReminders";
import { runDailyProspecting, processQueuedOutreach } from "@/lib/server/prospectStore";
import { requireAdmin } from "@/lib/server/requireAdmin";

/**
 * Three ways in: Vercel Cron (Authorization: Bearer CRON_SECRET -- Vercel only sends this header
 * if a CRON_SECRET env var has actually been set on the project; it is NOT generated or wired up
 * automatically just because this path is listed in vercel.json's crons, and a real production
 * backlog of 7+ day-old PENDING events confirmed this was never actually set, so the daily cron
 * had been silently 401'ing forever), a scheduled GitHub Actions workflow using the same bearer
 * token (see .github/workflows/automation-cron.yml -- runs every 15 minutes, since Vercel's Hobby
 * plan cron is capped at once/day regardless of the schedule configured in vercel.json), or a
 * logged-in admin clicking "Run now" on /admin/automations for manual/testing use.
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
  const timeTracking = await processTimeTrackingReminders();
  // Runs at most once per real Pacific calendar day regardless of how often this endpoint is hit
  // -- see runDailyProspecting's own idempotency marker.
  const prospecting = await runDailyProspecting();
  // Drains the admin's send queue a few at a time on every tick, independent of the once-a-day
  // discovery gate above -- this is what makes queued outreach go out one by one over time rather
  // than all at once.
  const outreachQueue = await processQueuedOutreach();
  return NextResponse.json({ ok: true, ...result, timeTracking, prospecting, outreachQueue });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
