import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listKeywordOpportunities, importKeywords, parseKeywordImportText } from "@/lib/server/keywordStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const keywords = await listKeywordOpportunities();
  return NextResponse.json({ ok: true, keywords });
}

const schema = z.object({ text: z.string().trim().min(1).max(20_000) });

/** Imports a pasted keyword list, AI-classifies category/intent/priority in batches. Real,
 *  paid model calls for anything beyond a trivial list, so rate-limited per admin. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`keyword-import:${admin.id}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many imports, please try again in a bit." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Paste at least one keyword" }, { status: 400 });

  const lines = parseKeywordImportText(parsed.data.text);
  if (lines.length === 0) return NextResponse.json({ ok: false, error: "Couldn't find any usable keywords in that text" }, { status: 400 });

  const result = await importKeywords(lines);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
