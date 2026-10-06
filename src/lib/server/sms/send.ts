import { prisma, isDatabaseConfigured } from "@/lib/db";
import { normalizePhone } from "./phone";
import { getSmsProvider } from "./provider";
import { hasSmsConsent, type SmsPurpose } from "./consent";

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("SMS sending requires DATABASE_URL to be configured.");
  return prisma;
}

export interface SendCustomerSmsInput {
  to: string;
  body: string;
  category: string; // booking_confirmation | reminder | schedule_update | arrival_update | service_completed | support_ack | help | invoice_payment_notice | tracking_link | chat_reply | ...
  customerId?: string | null;
  leadId?: string | null;
  purpose?: SmsPurpose;
  templateKey?: string;
  // STOP/HELP/START auto-replies are deterministic, compliance-required responses to an inbound
  // message -- not a proactive customer-care send -- so they bypass the consent check. Nothing
  // else should ever set this.
  bypassConsentCheck?: boolean;
}

export interface SendCustomerSmsResult {
  ok: boolean;
  mode: "live" | "mock" | "skipped";
  reason?: string;
  messageId?: string;
}

/**
 * THE single policy layer every outbound SMS in this app must go through -- see send.ts's own
 * callers. Flow: normalize recipient -> re-check consent fresh from the DB (never trust a cached
 * boolean) -> dispatch through the active SMSProvider (itself gated on SMS_ENABLED) -> log the
 * result to the messages table for the compliance log/audit trail.
 *
 * Without a real database (local dev without DATABASE_URL set, or a unit test exercising the
 * "mock adapters, no live credentials" path), there's no durable consent record or message log to
 * check or write to -- this degrades gracefully to "trust the caller's own consent flag and just
 * dispatch," matching how every other store in this codebase (leadStore, sendEmail, etc.) already
 * behaves in that mode, rather than hard-failing every SMS call.
 */
export async function sendCustomerSms(input: SendCustomerSmsInput): Promise<SendCustomerSmsResult> {
  const purpose = input.purpose ?? "customer_care";
  const to = normalizePhone(input.to);
  const dbReady = isDatabaseConfigured && prisma;

  if (!to) {
    if (dbReady) {
      await db().message.create({
        data: {
          customerId: input.customerId ?? null, leadId: input.leadId ?? null, channel: "SMS",
          templateKey: input.templateKey ?? null, body: input.body, toAddress: input.to,
          direction: "OUT", category: input.category, status: "failed", failedAt: new Date(),
          errorMessage: "Could not normalize phone number",
        },
      });
    }
    return { ok: false, mode: "skipped", reason: "invalid_phone" };
  }

  if (dbReady && !input.bypassConsentCheck) {
    const consented = await hasSmsConsent({ customerId: input.customerId, phone: to, purpose });
    if (!consented) {
      await db().message.create({
        data: {
          customerId: input.customerId ?? null, leadId: input.leadId ?? null, channel: "SMS",
          templateKey: input.templateKey ?? null, body: input.body, toAddress: to,
          direction: "OUT", category: input.category, status: "skipped",
          errorMessage: "No active SMS consent on file",
        },
      });
      return { ok: false, mode: "skipped", reason: "not_consented" };
    }
  }

  const provider = await getSmsProvider();
  const result = await provider.send({ to, body: input.body });
  const mode: SendCustomerSmsResult["mode"] = provider.name === "mock" ? "mock" : "live";

  if (!dbReady) return { ok: result.ok, mode, reason: result.error };

  const message = await db().message.create({
    data: {
      customerId: input.customerId ?? null,
      leadId: input.leadId ?? null,
      channel: "SMS",
      templateKey: input.templateKey ?? null,
      body: input.body,
      toAddress: to,
      direction: "OUT",
      category: input.category,
      provider: provider.name,
      providerMessageId: result.providerMessageId,
      status: result.ok ? (provider.name === "mock" ? "sent" : "queued") : "failed",
      sentAt: result.ok ? new Date() : null,
      failedAt: result.ok ? null : new Date(),
      errorMessage: result.error,
    },
  });

  return { ok: result.ok, mode, messageId: message.id, reason: result.error };
}
