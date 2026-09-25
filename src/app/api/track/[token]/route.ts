import { NextRequest, NextResponse } from "next/server";
import { getShareForTrackingPage } from "@/lib/server/trackingStore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getShareForTrackingPage(token);
  if (!result.ok) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(result);
}
