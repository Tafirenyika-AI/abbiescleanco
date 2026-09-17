import { prisma, isDatabaseConfigured } from "@/lib/db";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("Promotions require DATABASE_URL to be configured.");
  return prisma;
}

export const DISCOUNT_TYPES = ["PERCENT", "FIXED"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface PromoCodeItem {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  createdAt: string;
}

function map(p: {
  id: string; code: string; description: string | null; discountType: string; discountValue: number;
  active: boolean; startsAt: Date | null; expiresAt: Date | null; maxRedemptions: number | null;
  redemptionCount: number; createdAt: Date;
}): PromoCodeItem {
  return {
    id: p.id,
    code: p.code,
    description: p.description,
    discountType: p.discountType as DiscountType,
    discountValue: p.discountValue,
    active: p.active,
    startsAt: p.startsAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    maxRedemptions: p.maxRedemptions,
    redemptionCount: p.redemptionCount,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPromoCodes(): Promise<PromoCodeItem[]> {
  if (!isDatabaseConfigured || !prisma) return [];
  const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(map);
}

export async function createPromoCode(data: {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  startsAt?: string;
  expiresAt?: string;
  maxRedemptions?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const code = data.code.trim().toUpperCase();
  const existing = await db().promoCode.findUnique({ where: { code } });
  if (existing) return { ok: false, error: "A promo code with that code already exists" };

  const created = await db().promoCode.create({
    data: {
      code,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      maxRedemptions: data.maxRedemptions ?? null,
    },
  });
  return { ok: true, id: created.id };
}

export async function setPromoCodeActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().promoCode.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Promo code not found" };
  await db().promoCode.update({ where: { id }, data: { active } });
  return { ok: true };
}

export async function updatePromoCode(
  id: string,
  data: { description?: string; discountType?: DiscountType; discountValue?: number; expiresAt?: string | null; maxRedemptions?: number | null }
): Promise<{ ok: boolean; error?: string }> {
  const existing = await db().promoCode.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Promo code not found" };
  await db().promoCode.update({
    where: { id },
    data: {
      description: data.description !== undefined ? data.description || null : undefined,
      discountType: data.discountType,
      discountValue: data.discountValue,
      expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : undefined,
      maxRedemptions: data.maxRedemptions !== undefined ? data.maxRedemptions : undefined,
    },
  });
  return { ok: true };
}

/** Existing quotes keep their already-applied discount amount; only the link back to this code is cleared (ON DELETE SET NULL). */
export async function deletePromoCode(id: string): Promise<boolean> {
  const existing = await db().promoCode.findUnique({ where: { id } });
  if (!existing) return false;
  await db().promoCode.delete({ where: { id } });
  return true;
}

/** Checks a customer-typed code against active/date/redemption-limit rules — doesn't mutate anything. */
export async function validatePromoCode(rawCode: string): Promise<PromoCodeItem | null> {
  if (!isDatabaseConfigured || !prisma || !rawCode.trim()) return null;
  const code = rawCode.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return null;
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return null;
  if (promo.expiresAt && promo.expiresAt < now) return null;
  if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) return null;
  return map(promo);
}

/** Called once, when a quote is created against a validated code — increments the usage counter. */
export async function redeemPromoCode(id: string): Promise<void> {
  if (!isDatabaseConfigured || !prisma) return;
  await prisma.promoCode.update({ where: { id }, data: { redemptionCount: { increment: 1 } } });
}
