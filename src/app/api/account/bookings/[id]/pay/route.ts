import { NextRequest, NextResponse } from "next/server";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyBookingDetail } from "@/lib/server/clientPortalStore";
import { createCheckoutSession } from "@/lib/server/stripe";
import { createPendingStripePayment } from "@/lib/server/paymentStore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (booking.status === "CANCELLED") return NextResponse.json({ ok: false, error: "This booking is cancelled" }, { status: 400 });
  // The amount is always the server-computed balance, never a client-supplied figure.
  const balance = booking.balance ?? 0;
  if (balance < 50) return NextResponse.json({ ok: false, error: "Nothing left to pay on this booking" }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const session = await createCheckoutSession({
    bookingId: id,
    amount: balance,
    description: `${booking.serviceName} — Balance (${booking.reference})`,
    customerEmail: auth.ctx.email || undefined,
    successUrl: `${siteUrl}/pay/success`,
    cancelUrl: `${siteUrl}/account`,
  });
  if (!session.ok) return NextResponse.json({ ok: false, error: session.error }, { status: 400 });
  const recorded = await createPendingStripePayment({ bookingId: id, amount: balance, kind: "full_payment", stripePaymentIntentId: session.paymentIntentId });
  if (!recorded.ok) return NextResponse.json({ ok: false, error: recorded.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: session.url });
}
