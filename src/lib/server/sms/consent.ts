import { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { normalizePhone } from "./phone";

/**
 * Real production data has Customer.phone stored in whatever format it was typed in at each entry
 * point (raw digits, "(650) 555-1234", etc. -- confirmed by sampling real rows) rather than
 * normalized E.164. Telnyx always sends E.164 for an inbound sender's number, so an exact-string
 * match would silently fail to find the right customer for a STOP/START/HELP keyword (or any
 * consent check) whenever their phone wasn't stored in plain-digit form -- a real compliance risk,
 * since a missed match means CommunicationPreference never gets updated. Matches on the last 10
 * digits (the US national number) regardless of how either side is formatted.
 */
async function findCustomerIdByPhoneLoose(phone: string): Promise<string | null> {
  if (!isDatabaseConfigured || !prisma) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM customers WHERE "deletedAt" IS NULL AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(${phone}, '[^0-9]', '', 'g'), 10) ORDER BY "createdAt" DESC LIMIT 1`
  );
  return rows[0]?.id ?? null;
}

function db() {
  if (!isDatabaseConfigured || !prisma) throw new Error("SMS consent requires DATABASE_URL to be configured.");
  return prisma;
}

/** Bump this when the consent disclosure text changes materially -- recorded on every consent
 *  event so a defensible record exists of exactly which wording a customer agreed to. */
export const SMS_DISCLOSURE_VERSION = "2026-10-05";

export type SmsPurpose = "customer_care" | "marketing";
export type SmsConsentMethod = "website_form" | "keyword" | "inbound" | "admin_documented";
export type SmsConsentSource = "booking" | "quote" | "contact" | "signup" | "account_settings" | "sms_keyword";

export interface RecordConsentInput {
  customerId?: string | null;
  leadId?: string | null;
  phone: string;
  purpose: SmsPurpose;
  status: "opted_in" | "opted_out";
  method: SmsConsentMethod;
  source: SmsConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes a new, immutable SmsConsentEvent (the defensible audit trail -- never updated or deleted,
 * a later opt-out is always a NEW row, not an edit of a prior one) and mirrors the current state
 * onto CommunicationPreference.smsConsent / smsMarketingConsent (the simple flag every send-time
 * consent check actually reads, kept separate on purpose: opting into one never implies the other).
 */
export async function recordSmsConsentEvent(input: RecordConsentInput): Promise<void> {
  // Graceful no-op without a real database, matching every other store in this codebase (e.g.
  // leadStore's JSON-mock fallback) -- there's no durable place to write a consent record to, and
  // the public forms that call this must keep working in that mode for local/offline testing.
  if (!isDatabaseConfigured || !prisma) return;

  const phone = normalizePhone(input.phone) ?? input.phone;
  const optedIn = input.status === "opted_in";

  await db().smsConsentEvent.create({
    data: {
      customerId: input.customerId ?? null,
      leadId: input.leadId ?? null,
      phone,
      channel: input.purpose === "marketing" ? "sms_marketing" : "sms",
      purpose: input.purpose,
      status: input.status,
      method: input.method,
      source: input.source,
      disclosureVersion: SMS_DISCLOSURE_VERSION,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  if (input.customerId) {
    const field = input.purpose === "marketing" ? "smsMarketingConsent" : "smsConsent";
    await db().communicationPreference.upsert({
      where: { customerId: input.customerId },
      update: { [field]: optedIn, ...(optedIn ? {} : { unsubscribedAt: new Date() }) },
      create: { customerId: input.customerId, [field]: optedIn, ...(optedIn ? {} : { unsubscribedAt: new Date() }) },
    });
  }
}

/**
 * Fresh, send-time consent check -- never trust a boolean the caller cached earlier. Prefers the
 * linked customer's CommunicationPreference (authoritative); falls back to looking up a customer by
 * phone number (covers an inbound STOP from a number not explicitly passed as a customerId) if no
 * customerId is known.
 */
export async function hasSmsConsent(opts: { customerId?: string | null; phone?: string | null; purpose: SmsPurpose }): Promise<boolean> {
  if (!isDatabaseConfigured || !prisma) return false;
  const field = opts.purpose === "marketing" ? "smsMarketingConsent" : "smsConsent";

  if (opts.customerId) {
    const pref = await db().communicationPreference.findUnique({ where: { customerId: opts.customerId } });
    if (pref) return pref[field];
  }

  if (opts.phone) {
    const customerId = await findCustomerIdByPhoneLoose(opts.phone);
    if (customerId) {
      const pref = await db().communicationPreference.findUnique({ where: { customerId } });
      if (pref) return pref[field];
    }
  }

  return false;
}

/** Looks up a real Customer by phone for inbound webhook handling (STOP/START/HELP, or routing an
 *  ordinary reply to the right conversation) -- phone numbers aren't unique in the schema, so this
 *  takes the most recently created match. */
export async function findCustomerByPhone(phone: string): Promise<{ id: string } | null> {
  const id = await findCustomerIdByPhoneLoose(phone);
  return id ? { id } : null;
}
