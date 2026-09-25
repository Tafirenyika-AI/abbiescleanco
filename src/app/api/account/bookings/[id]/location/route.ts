import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyBookingDetail } from "@/lib/server/clientPortalStore";
import { getActiveLocationForBooking } from "@/lib/server/trackingStore";
import { getIntegrationValue } from "@/lib/server/integrationSettings";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  // getMyBookingDetail already enforces this booking belongs to the calling customer.
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const location = await getActiveLocationForBooking(id);
  const mapsApiKey = (await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) ?? null;
  return NextResponse.json({ ok: true, ...location, mapsApiKey });
}
