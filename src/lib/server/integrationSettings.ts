import type { Prisma } from "@prisma/client";
import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Admin-managed integration credentials, stored in `business_settings` under
 * key "integrations" so they can be set from /admin/settings without a
 * redeploy. This is a pragmatic tradeoff, not a secrets vault: values sit as
 * plain JSON in the database (protected only by DB access control + TLS in
 * transit), not application-level encrypted. For anything beyond a small
 * business site, prefer real secret storage (e.g. your host's encrypted env
 * vars, or a vault) over this. Every field here also has an environment-
 * variable fallback (see .env.example) that still works if DATABASE_URL
 * isn't set or nothing has been saved here yet — env vars always win when
 * BOTH are present is NOT the rule: DB value wins when set, else env var.
 */
export interface IntegrationSettings {
  resendApiKey?: string;
  emailFrom?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  googleMapsApiKey?: string;
  turnstileSecretKey?: string;
  turnstileSiteKey?: string;
  sentryDsn?: string;
}

const SECRET_FIELDS: (keyof IntegrationSettings)[] = [
  "resendApiKey",
  "twilioAccountSid",
  "twilioAuthToken",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "googleMapsApiKey",
  "turnstileSecretKey",
];

async function getRaw(): Promise<IntegrationSettings> {
  if (!isDatabaseConfigured || !prisma) return {};
  const row = await prisma.businessSetting.findUnique({ where: { key: "integrations" } });
  return (row?.value as IntegrationSettings | undefined) ?? {};
}

/** For server-side use only (adapters) — real values, DB overrides env. */
export async function getIntegrationValue(field: keyof IntegrationSettings, envVar: string): Promise<string | undefined> {
  const settings = await getRaw();
  return settings[field] || process.env[envVar] || undefined;
}

/** For the admin UI — never sends real secret values to the client, only whether each is configured. */
export async function getIntegrationStatus(): Promise<Record<keyof IntegrationSettings, { configured: boolean; source: "database" | "environment" | "none"; value?: string }>> {
  const settings = await getRaw();
  const envMap: Record<keyof IntegrationSettings, string> = {
    resendApiKey: "RESEND_API_KEY",
    emailFrom: "EMAIL_FROM",
    twilioAccountSid: "TWILIO_ACCOUNT_SID",
    twilioAuthToken: "TWILIO_AUTH_TOKEN",
    twilioFromNumber: "TWILIO_FROM_NUMBER",
    stripeSecretKey: "STRIPE_SECRET_KEY",
    stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
    googleMapsApiKey: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    turnstileSecretKey: "TURNSTILE_SECRET_KEY",
    turnstileSiteKey: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    sentryDsn: "NEXT_PUBLIC_SENTRY_DSN",
  };

  const result = {} as Record<keyof IntegrationSettings, { configured: boolean; source: "database" | "environment" | "none"; value?: string }>;
  for (const field of Object.keys(envMap) as (keyof IntegrationSettings)[]) {
    const dbValue = settings[field];
    const envValue = process.env[envMap[field]];
    const isSecret = SECRET_FIELDS.includes(field);
    if (dbValue) {
      result[field] = { configured: true, source: "database", value: isSecret ? undefined : dbValue };
    } else if (envValue) {
      result[field] = { configured: true, source: "environment", value: isSecret ? undefined : envValue };
    } else {
      result[field] = { configured: false, source: "none" };
    }
  }
  return result;
}

/** Only overwrites fields that were actually submitted with a non-empty value — leaves everything else untouched. */
export async function saveIntegrationSettings(patch: Partial<IntegrationSettings>): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  const current = await getRaw();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value) next[key as keyof IntegrationSettings] = value;
  }
  await prisma.businessSetting.upsert({
    where: { key: "integrations" },
    update: { value: next as Prisma.InputJsonValue },
    create: { key: "integrations", value: next as Prisma.InputJsonValue },
  });
}

export async function clearIntegrationField(field: keyof IntegrationSettings): Promise<void> {
  if (!isDatabaseConfigured || !prisma) throw new Error("Requires DATABASE_URL to be configured.");
  const current = await getRaw();
  delete current[field];
  await prisma.businessSetting.upsert({
    where: { key: "integrations" },
    update: { value: current as Prisma.InputJsonValue },
    create: { key: "integrations", value: current as Prisma.InputJsonValue },
  });
}
