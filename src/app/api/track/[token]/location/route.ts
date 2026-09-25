import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { recordLocation } from "@/lib/server/trackingStore";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // The token itself is the real access control (unguessable, single-purpose); this rate limit
  // just caps how often any one link can hammer the endpoint, not who's allowed to call it.
  const rate = await checkRateLimit(`track-location:${token}`, 30, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many updates" }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid location" }, { status: 400 });

  const result = await recordLocation(token, parsed.data.lat, parsed.data.lng, parsed.data.accuracyMeters ?? null);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
