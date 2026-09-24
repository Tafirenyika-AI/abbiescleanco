import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listPropertyManagers, setPropertyManagerFlag } from "@/lib/server/propertyManagerStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const propertyManagers = await listPropertyManagers();
  return NextResponse.json({ ok: true, propertyManagers });
}

const schema = z.object({ customerId: z.string().trim().min(1) });

/** Flags an existing customer as a property manager -- does not create a new customer. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pick a customer" }, { status: 400 });

  const result = await setPropertyManagerFlag(parsed.data.customerId, true, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
