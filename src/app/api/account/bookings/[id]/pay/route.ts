import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/server/customerContext";
import { getMyBookingDetail } from "@/lib/server/clientPortalStore";
import { createCheckoutSession } from "@/lib/server/stripe";
import { createPendingStripePayment } from "@/lib/server/paymentStore";

const schema = z.object({ amount: z.number().int().positive().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { mutating: true });
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const booking = await getMyBookingDetail(auth.ctx.customerId, id);
  if (!booking) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (booking.status === "CANCELLED") return NextResponse.json({ ok: false, error: "This booking is cancelled" }, { status: 400 });
  const balance = booking.balance ?? 0;
  if (balance < 50) return NextResponse.json({ ok: false, error: "Nothing left to pay on this booking" }, { status: 400 });

  // A customer can pay any part of the balance now (e.g. $100 today, $65 later by a different
  // method) -- the requested amount is validated server-side against the real balance, never
  // trusted outright, and defaults to paying it all off in one go if not specified.
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  const amount = parsed.data.amount ?? balance;
  if (amount < 50) return NextResponse.json({ ok: false, error: "Enter at least $0.50" }, { status: 400 });
  if (amount > balance) return NextResponse.json({ ok: false, error: "That's more than the remaining balance" }, { status: 400 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  const session = await createCheckoutSession({
    bookingId: id,
    amount,
    description: `${booking.serviceName}, ${amount >= balance ? "Balance" : "Partial payment"} (${booking.reference})`,
    customerEmail: auth.ctx.email || undefined,
    successUrl: `${siteUrl}/pay/success`,
    cancelUrl: `${siteUrl}/account`,
  });
  if (!session.ok) return NextResponse.json({ ok: false, error: session.error }, { status: 400 });
  const recorded = await createPendingStripePayment({ bookingId: id, amount, kind: amount >= balance ? "full_payment" : "deposit", stripePaymentIntentId: session.paymentIntentId });
  if (!recorded.ok) return NextResponse.json({ ok: false, error: recorded.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: session.url });
}
