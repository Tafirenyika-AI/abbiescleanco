import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createLocationShare } from "@/lib/server/trackingStore";

const schema = z.object({ phone: z.string().trim().regex(/^\+?[0-9()\-.\s]{7,20}$/, "Enter a real phone number") });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Invalid phone number" }, { status: 400 });

  const result = await createLocationShare(id, parsed.data.phone, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
