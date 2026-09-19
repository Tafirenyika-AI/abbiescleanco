import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/customerContext";
import { listThread, addClientNote } from "@/lib/server/clientPortalStore";

export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const sp = req.nextUrl.searchParams;
  const thread = await listThread(auth.ctx.customerId, { leadId: sp.get("leadId") || undefined, bookingId: sp.get("bookingId") || undefined });
  if (!thread) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...thread });
}

const schema = z.object({ leadId: z.string().optional(), bookingId: z.string().optional(), body: z.string().trim().min(1).max(4000) });

export async function POST(req: NextRequest) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Please write a note first" }, { status: 400 });
  const { leadId, bookingId, body } = parsed.data;
  const res = await addClientNote(auth.ctx.customerId, { leadId, bookingId }, body, "NOTE", `${auth.ctx.firstName} ${auth.ctx.lastName}`.trim());
  return NextResponse.json(res, { status: res.ok ? 200 : 404 });
}
