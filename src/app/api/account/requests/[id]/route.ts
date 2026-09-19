import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/customerContext";
import { updateRequestInstructions } from "@/lib/server/clientPortalStore";

const schema = z.object({ instructions: z.string().max(2000) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const res = await updateRequestInstructions(auth.ctx.customerId, id, parsed.data.instructions);
  return NextResponse.json(res, { status: res.ok ? 200 : res.error === "Not found" ? 404 : 400 });
}
