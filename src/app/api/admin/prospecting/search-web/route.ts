import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { searchWebForCleaningLeads } from "@/lib/server/prospectStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

/** Triggers a real web search for people/businesses currently looking to hire a cleaner (see
 *  searchWebForCleaningLeads's own docstring). Rate-limited per admin -- each call is a real,
 *  paid, multi-search model call, not a quick lookup. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`prospecting-web-search:${admin.id}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many web searches, please try again in a bit." }, { status: 429 });

  const result = await searchWebForCleaningLeads();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
