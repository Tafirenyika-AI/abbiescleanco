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

export interface CreatePaymentLinkInput {
  amount: number; // cents, the total across everything this link covers
  description: string;
  successUrl: string;
}

/**
 * A real Stripe Payment Link (`stripe.paymentLinks.create`), not a Checkout Session -- Checkout
 * Session URLs expire within 24 hours no matter how they're configured, which doesn't fit "stays
 * in our system for future records" when an invoice can legitimately sit unpaid for its full Net
 * 15 term. A Payment Link's hosted URL stays live indefinitely until explicitly deactivated (see
 * deactivatePaymentLink below), so the link we store and email today still works in two weeks.
 * When someone actually pays through it, Stripe creates a Checkout Session behind the scenes whose
 * `payment_link` field names this link's id -- that's what the webhook uses to find it again (see
 * /api/stripe/webhook).
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<{ ok: true; url: string; paymentLinkId: string } | { ok: false; error: string }> {
  const stripe = await getStripeClient();
  if (!stripe) return { ok: false, error: "Stripe isn't configured yet, add a Secret Key in Settings → Integrations." };

  try {
    const link = await stripe.paymentLinks.create({
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
      after_completion: { type: "redirect", redirect: { url: input.successUrl } },
    });
    return { ok: true, url: link.url, paymentLinkId: link.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe request failed" };
  }
}

/** Deactivates a Payment Link on Stripe's side so the real hosted page stops accepting money --
 *  used when an admin voids a link before it's paid. The link's record stays in our own DB either
 *  way; this only stops it from being usable. */
export async function deactivatePaymentLink(paymentLinkId: string): Promise<boolean> {
  const stripe = await getStripeClient();
  if (!stripe) return false;
  try {
    await stripe.paymentLinks.update(paymentLinkId, { active: false });
    return true;
  } catch {
    return false;
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
