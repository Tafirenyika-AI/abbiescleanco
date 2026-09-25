import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyBookingDetail } from "@/lib/server/clientPortalStore";
import { listMessagesForBooking, sendMessage } from "@/lib/server/trackingStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, messages: await listMessagesForBooking(id) });
}

const schema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Message can't be empty" }, { status: 400 });

  const result = await sendMessage(id, "CUSTOMER", parsed.data.body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
