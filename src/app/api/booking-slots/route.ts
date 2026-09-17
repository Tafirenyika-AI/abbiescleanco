import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/server/bookingAvailability";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { serviceIds } from "@/lib/validation/quote";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`booking-slots:${ip}`, 60, 10 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });

  const service = req.nextUrl.searchParams.get("service");
  const date = req.nextUrl.searchParams.get("date");
  if (!service || !(serviceIds as readonly string[]).includes(service)) {
    return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  const pricingConfig = await getPricingConfig();
  const slots = await getAvailableSlots(service as (typeof serviceIds)[number], date, pricingConfig);
  return NextResponse.json({ ok: true, slots });
}
