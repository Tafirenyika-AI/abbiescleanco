import Stripe from "stripe";
import { getIntegrationValue } from "./integrationSettings";

/**
 * Lazy per-call client (not instantiated at module load) so a DB-stored key
 * saved from /admin/settings takes effect immediately, without a restart —
 * same pattern as email.ts/sms.ts.
 */
async function getStripeClient(): Promise<Stripe | null> {
  const secretKey = await getIntegrationValue("stripeSecretKey", "STRIPE_SECRET_KEY");
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export async function isStripeConfigured(): Promise<boolean> {
  return !!(await getIntegrationValue("stripeSecretKey", "STRIPE_SECRET_KEY"));
}

export interface CreateCheckoutSessionInput {
  bookingId: string;
  amount: number; // cents
  description: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Stripe Checkout — a Stripe-hosted payment page. Apple Pay and Google Pay
 * are offered automatically on eligible devices/browsers as part of the
 * "card" payment method; there's no separate wallet-specific integration
 * needed on our side.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<{ ok: true; url: string; paymentIntentId: string } | { ok: false; error: string }> {
  const stripe = await getStripeClient();
  if (!stripe) return { ok: false, error: "Stripe isn't configured yet, add a Secret Key in Settings → Integrations." };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: input.amount,
            product_data: { name: input.description },
          },
          quantity: 1,
        },
      ],
      customer_email: input.customerEmail,
      client_reference_id: input.bookingId,
      metadata: { bookingId: input.bookingId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expand: ["payment_intent"],
    });

    const paymentIntent = session.payment_intent;
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
    if (!session.url || !paymentIntentId) return { ok: false, error: "Stripe didn't return a session URL" };

    return { ok: true, url: session.url, paymentIntentId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe request failed" };
  }
}

export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<Stripe.Event | null> {
  const stripe = await getStripeClient();
  const webhookSecret = await getIntegrationValue("stripeWebhookSecret", "STRIPE_WEBHOOK_SECRET");
  if (!stripe || !webhookSecret) return null;

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return null;
  }
}

/** Stripe's own hosted receipt for a completed charge, used as automatic proof-of-payment. */
export async function getPaymentIntentReceiptUrl(paymentIntentId: string): Promise<string | null> {
  const stripe = await getStripeClient();
  if (!stripe) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge;
    if (charge && typeof charge !== "string") return charge.receipt_url ?? null;
    return null;
  } catch {
    return null;
  }
}
