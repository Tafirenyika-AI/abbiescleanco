import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyWebhookSignature, getPaymentIntentReceiptUrl } from "@/lib/server/stripe";
import { markPaymentByIntentId } from "@/lib/server/paymentStore";
import { markPaymentLinkPaid } from "@/lib/server/invoicePaymentLinkStore";
import { notifyAdmins } from "@/lib/server/notificationStore";
import { sendEmail, paymentReceiptEmail } from "@/lib/server/email";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });

  const rawBody = await req.text();
  const event = await verifyWebhookSignature(rawBody, signature);
  if (!event) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;

    // A session created from one of our invoice Payment Links (see invoicePaymentLinkStore.ts) --
    // handled separately from the single-booking deposit/checkout flow below, since one link can
    // cover several invoices/bookings at once.
    if (paymentLinkId) {
      const linkResult = await markPaymentLinkPaid(paymentLinkId, session.id, paymentIntentId ?? null);
      if (linkResult) {
        const receiptUrl = paymentIntentId ? await getPaymentIntentReceiptUrl(paymentIntentId) : null;
        const invoiceList = linkResult.invoiceNumbers.join(", ");
        await notifyAdmins(
          "PAYMENT_RECEIVED",
          `Invoice payment received: $${(linkResult.amount / 100).toFixed(2)}`,
          `${linkResult.customerName}, ${invoiceList}`,
          "/admin/invoices"
        );
        if (linkResult.customerEmail) {
          const { subject, html } = await paymentReceiptEmail({
            firstName: linkResult.customerName.split(" ")[0] || "there",
            amountLabel: `$${(linkResult.amount / 100).toFixed(2)}`,
            description: linkResult.invoiceNumbers.length === 1 ? `invoice ${invoiceList}` : `invoices ${invoiceList}`,
            receiptUrl,
          });
          await sendEmail({ to: linkResult.customerEmail, subject, html });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (paymentIntentId) {
      const receiptUrl = await getPaymentIntentReceiptUrl(paymentIntentId);
      const result = await markPaymentByIntentId(paymentIntentId, "PAID", receiptUrl);
      if (result) {
        await notifyAdmins(
          "PAYMENT_RECEIVED",
          `Payment received: $${(result.amount / 100).toFixed(2)}`,
          result.customerName,
          result.bookingId ? `/admin/bookings/${result.bookingId}` : "/admin/payments"
        );
        if (result.customerEmail) {
          const { subject, html } = await paymentReceiptEmail({
            firstName: result.customerName.split(" ")[0] || "there",
            amountLabel: `$${(result.amount / 100).toFixed(2)}`,
            description: "your booking",
            receiptUrl,
          });
          await sendEmail({ to: result.customerEmail, subject, html });
        }
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const result = await markPaymentByIntentId(paymentIntent.id, "FAILED");
    if (result) {
      await notifyAdmins(
        "PAYMENT_FAILED",
        `Payment failed: $${(result.amount / 100).toFixed(2)}`,
        result.customerName,
        result.bookingId ? `/admin/bookings/${result.bookingId}` : "/admin/payments"
      );
    }
  }

  return NextResponse.json({ ok: true });
}
