import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { callCustomerFromCleaner } from "@/lib/server/trackingStore";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A phone call costs real money -- cap how often any one link can trigger one, on top of the
  // token itself already being the real access control.
  const rate = await checkRateLimit(`track-call:${token}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many call attempts, please wait a few minutes" }, { status: 429 });

  const result = await callCustomerFromCleaner(token);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
