import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyQuoteDetail } from "@/lib/server/clientPortalStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const quote = await getMyQuoteDetail(auth.ctx.customerId, id);
  if (!quote) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, quote });
}
