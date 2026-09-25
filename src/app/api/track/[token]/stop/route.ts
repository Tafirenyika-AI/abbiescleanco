import { NextRequest, NextResponse } from "next/server";
import { stopSharing } from "@/lib/server/trackingStore";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await stopSharing(token);
  return NextResponse.json(result);
}
