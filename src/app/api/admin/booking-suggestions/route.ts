import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getSuggestedSlots } from "@/lib/server/bookingAvailability";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { serviceIds } from "@/lib/validation/quote";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const service = req.nextUrl.searchParams.get("service");
  const date = req.nextUrl.searchParams.get("date");
  const city = req.nextUrl.searchParams.get("city") || undefined;
  const staffAssignee = req.nextUrl.searchParams.get("staff") || undefined;
  if (!service || !(serviceIds as readonly string[]).includes(service)) {
    return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  const pricingConfig = await getPricingConfig();
  const slots = await getSuggestedSlots(service as (typeof serviceIds)[number], date, pricingConfig, { city, staffAssignee });
  return NextResponse.json({ ok: true, slots });
}
