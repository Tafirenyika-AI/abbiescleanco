import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { withdrawRequest } from "@/lib/server/clientPortalStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const { id } = await params;
  const res = await withdrawRequest(auth.ctx.customerId, id, typeof body.reason === "string" ? body.reason : undefined);
  return NextResponse.json(res, { status: res.ok ? 200 : res.error === "Not found" ? 404 : 400 });
}
