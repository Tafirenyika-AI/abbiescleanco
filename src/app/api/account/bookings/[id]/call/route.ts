import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyBookingDetail } from "@/lib/server/clientPortalStore";
import { callCleanerFromCustomer } from "@/lib/server/trackingStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const rate = await checkRateLimit(`account-call:${id}`, 5, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many call attempts, please wait a few minutes" }, { status: 429 });

  const result = await callCleanerFromCustomer(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
