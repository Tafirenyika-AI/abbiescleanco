import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { pricingConfigSchema } from "@/lib/validation/pricingConfig";
import { getPricingConfig, savePricingConfig } from "@/lib/server/pricingStore";
import { notifyAdmins } from "@/lib/server/notificationStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const config = await getPricingConfig();
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_PRICING");
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = pricingConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  await savePricingConfig(parsed.data);
  await notifyAdmins("PRICING_CHANGED", "Pricing updated", `${admin.name} changed pricing`, "/admin/pricing");
  return NextResponse.json({ ok: true });
}
