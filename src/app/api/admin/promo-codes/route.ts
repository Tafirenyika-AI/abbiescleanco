import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listPromoCodes, createPromoCode, DISCOUNT_TYPES } from "@/lib/server/promoCodeStore";

const createSchema = z.object({
  code: z.string().trim().min(2).max(30),
  description: z.string().trim().max(300).optional(),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.coerce.number().int().min(1),
  startsAt: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
  maxRedemptions: z.coerce.number().int().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const promoCodes = await listPromoCodes();
  return NextResponse.json({ ok: true, promoCodes });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.discountType === "PERCENT" && parsed.data.discountValue > 100) {
    return NextResponse.json({ ok: false, error: "Percent discount can't exceed 100" }, { status: 400 });
  }

  const result = await createPromoCode(parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
