import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveGuestAssistantQuery } from "@/lib/server/guestAssistant";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({ query: z.string().trim().min(1).max(200) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await checkRateLimit(`guest-assistant:${ip}`, 30, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests, please try again shortly." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Ask me something first" }, { status: 400 });

  const result = await resolveGuestAssistantQuery(parsed.data.query);
  return NextResponse.json({ ok: true, result });
}
