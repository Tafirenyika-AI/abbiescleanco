import { NextRequest, NextResponse } from "next/server";
import { resolveBookingForToken } from "@/lib/server/trackingStore";
import { clockOutViaToken } from "@/lib/server/bookingStore";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveBookingForToken(token);
  if (!resolved) return NextResponse.json({ ok: false, error: "This link isn't active" }, { status: 404 });
  const result = await clockOutViaToken(resolved.bookingId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
