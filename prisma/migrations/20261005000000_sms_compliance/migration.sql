-- Additive only. SMS compliance infrastructure for the Telnyx 10DLC Customer Care campaign:
-- a separate marketing-consent flag, a defensible append-only consent audit trail, an extended
-- message log (outbound + inbound SMS, reusing the existing unused `messages` table instead of a
-- parallel one), and a generic webhook idempotency guard. No existing column, row, or relationship
-- is touched.

ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "smsMarketingConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "sms_consent_events" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "leadId" TEXT,
  "phone" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'sms',
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "disclosureVersion" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sms_consent_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_consent_events_customerId_idx" ON "sms_consent_events"("customerId");
CREATE INDEX IF NOT EXISTS "sms_consent_events_leadId_idx" ON "sms_consent_events"("leadId");
CREATE INDEX IF NOT EXISTS "sms_consent_events_phone_idx" ON "sms_consent_events"("phone");
CREATE INDEX IF NOT EXISTS "sms_consent_events_createdAt_idx" ON "sms_consent_events"("createdAt");

ALTER TABLE "sms_consent_events" ADD CONSTRAINT "sms_consent_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sms_consent_events" ADD CONSTRAINT "sms_consent_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "leadId" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "direction" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "fromAddress" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "errorCode" TEXT;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_providerMessageId_key" UNIQUE ("providerMessageId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "messages_leadId_idx" ON "messages"("leadId");
CREATE INDEX IF NOT EXISTS "messages_toAddress_idx" ON "messages"("toAddress");
CREATE INDEX IF NOT EXISTS "messages_status_idx" ON "messages"("status");
CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "messages"("createdAt");

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_provider_eventId_key" UNIQUE ("provider", "eventId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
