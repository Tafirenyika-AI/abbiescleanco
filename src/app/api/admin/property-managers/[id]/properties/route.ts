import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { addProperty } from "@/lib/server/propertyManagerStore";

const schema = z.object({
  label: z.string().trim().max(100).nullable(),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(20),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  propertyType: z.enum(["apartment", "house", "townhome", "commercial"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await addProperty(id, parsed.data, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
