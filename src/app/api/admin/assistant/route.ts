import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { resolveAssistantQuery } from "@/lib/server/assistant";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({ query: z.string().trim().min(1).max(200) });

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`admin-assistant:${admin.id}`, 30, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests, please try again shortly." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ask me something first" }, { status: 400 });

  const result = await resolveAssistantQuery(parsed.data.query);
  return NextResponse.json({ ok: true, result });
}
