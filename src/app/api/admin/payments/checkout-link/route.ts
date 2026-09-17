import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getBookingById } from "@/lib/server/bookingStore";
import { createCheckoutSession } from "@/lib/server/stripe";
import { createPendingStripePayment } from "@/lib/server/paymentStore";
import { sendEmail, paymentLinkEmail } from "@/lib/server/email";

const schema = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().int().min(50), // Stripe's practical minimum is ~$0.50
  kind: z.enum(["deposit", "full_payment"]),
  emailToCustomer: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "VIEW_REPORTS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const booking = await getBookingById(parsed.data.bookingId);
  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const session = await createCheckoutSession({
    bookingId: parsed.data.bookingId,
    amount: parsed.data.amount,
    description: `${booking.serviceName} — ${parsed.data.kind === "deposit" ? "Deposit" : "Payment"} (${booking.reference})`,
    customerEmail: booking.customerEmail || undefined,
    successUrl: `${siteUrl}/pay/success`,
    cancelUrl: `${siteUrl}/pay/cancelled`,
  });
  if (!session.ok) return NextResponse.json({ ok: false, error: session.error }, { status: 400 });

  const recorded = await createPendingStripePayment({
    bookingId: parsed.data.bookingId,
    amount: parsed.data.amount,
    kind: parsed.data.kind,
    stripePaymentIntentId: session.paymentIntentId,
  });
  if (!recorded.ok) return NextResponse.json({ ok: false, error: recorded.error }, { status: 400 });

  if (parsed.data.emailToCustomer && booking.customerEmail) {
    const { subject, html } = paymentLinkEmail({
      firstName: booking.customerName.split(" ")[0] || "there",
      amountLabel: `$${(parsed.data.amount / 100).toFixed(2)}`,
      description: `${parsed.data.kind === "deposit" ? "A deposit is requested" : "Payment is requested"} for your ${booking.serviceName.toLowerCase()} (${booking.reference}).`,
      url: session.url,
    });
    await sendEmail({ to: booking.customerEmail, subject, html });
  }

  return NextResponse.json({ ok: true, url: session.url });
}
