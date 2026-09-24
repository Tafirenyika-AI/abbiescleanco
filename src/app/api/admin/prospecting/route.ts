import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listProspects, searchAndSaveProspects, PROSPECT_CATEGORIES, PROSPECT_STATUSES } from "@/lib/server/prospectStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const prospects = await listProspects({
    status: status && (PROSPECT_STATUSES as readonly string[]).includes(status) ? (status as (typeof PROSPECT_STATUSES)[number]) : undefined,
    category: category && (PROSPECT_CATEGORIES as readonly string[]).includes(category) ? (category as (typeof PROSPECT_CATEGORIES)[number]) : undefined,
  });
  return NextResponse.json({ ok: true, prospects });
}

const searchSchema = z.object({
  query: z.string().trim().min(2).max(200),
  category: z.enum(PROSPECT_CATEGORIES),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a search term (at least 2 characters) and a category." }, { status: 400 });

  // Each search now also does real AI query-planning plus multiple Google Places calls, not a
  // single quick lookup -- same reasoning as the web-intent search's rate limit.
  const rate = await checkRateLimit(`prospecting-search:${admin.id}`, 20, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many searches, please try again in a bit." }, { status: 429 });

  const result = await searchAndSaveProspects(parsed.data.query, parsed.data.category);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
