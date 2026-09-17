import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { setPromoCodeActive, updatePromoCode, deletePromoCode, DISCOUNT_TYPES } from "@/lib/server/promoCodeStore";

const activeSchema = z.object({ active: z.boolean() });
const updateSchema = z.object({
  description: z.string().trim().max(300).optional(),
  discountType: z.enum(DISCOUNT_TYPES).optional(),
  discountValue: z.coerce.number().int().min(1).optional(),
  expiresAt: z.string().trim().nullable().optional(),
  maxRedemptions: z.coerce.number().int().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const activeParsed = activeSchema.safeParse(body);
  if (activeParsed.success) {
    const result = await setPromoCodeActive(id, activeParsed.data.active);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.discountType === "PERCENT" && parsed.data.discountValue && parsed.data.discountValue > 100) {
    return NextResponse.json({ ok: false, error: "Percent discount can't exceed 100" }, { status: 400 });
  }

  const result = await updatePromoCode(id, parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await deletePromoCode(id);
  if (!deleted) return NextResponse.json({ ok: false, error: "Promo code not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
