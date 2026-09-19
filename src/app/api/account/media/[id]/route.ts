import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { deleteClientAttachment } from "@/lib/server/clientPortalStore";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const res = await deleteClientAttachment(auth.ctx.customerId, id);
  return NextResponse.json(res, { status: res.ok ? 200 : 404 });
}
