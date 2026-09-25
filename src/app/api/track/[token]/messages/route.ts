import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { resolveBookingForToken, listMessagesForBooking, sendMessage } from "@/lib/server/trackingStore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveBookingForToken(token);
  if (!resolved) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, messages: await listMessagesForBooking(resolved.bookingId) });
}

const schema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveBookingForToken(token);
  if (!resolved) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const rate = await checkRateLimit(`track-message:${token}`, 20, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many messages, please slow down" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Message can't be empty" }, { status: 400 });

  const result = await sendMessage(resolved.bookingId, "CLEANER", parsed.data.body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
