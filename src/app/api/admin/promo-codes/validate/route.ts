import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { validatePromoCode } from "@/lib/server/promoCodeStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code") ?? "";
  const promo = await validatePromoCode(code);
  if (!promo) return NextResponse.json({ ok: true, valid: false });
  return NextResponse.json({ ok: true, valid: true, promo });
}
