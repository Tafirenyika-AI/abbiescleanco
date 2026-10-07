-- Daily automated prospecting: a short SMS-length draft alongside the existing email draft, and a
-- dedicated notification type for its daily digest. Additive only.
ALTER TABLE "prospects" ADD COLUMN "draftSmsBody" TEXT;
ALTER TYPE "AdminNotificationType" ADD VALUE 'PROSPECTING_DIGEST';
