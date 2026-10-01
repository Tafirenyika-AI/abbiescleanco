-- Additive only. Upgrades the Quote/QuoteItem models for recurring commercial cleaning
-- quotations without touching any existing column, row, or relationship.

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discountType" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discountValue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "depositType" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "depositValue" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "scopeOfService" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "exclusions" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "customerMessage" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "revisionNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "revisedFromId" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);

-- Backfill: existing quotes already have a real `discount`/`deposit` cents figure -- treat those as
-- FIXED-type raw values so the new columns describe real history instead of defaulting to 0 and
-- silently losing what discountType/discountValue would otherwise claim.
UPDATE "quotes" SET "discountValue" = "discount" WHERE "discount" > 0 AND "discountValue" = 0;
UPDATE "quotes" SET "depositType" = 'FIXED', "depositValue" = "deposit" WHERE "deposit" > 0 AND "depositValue" = 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quotes_revisedFromId_fkey' AND table_name = 'quotes'
  ) THEN
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_revisedFromId_fkey"
      FOREIGN KEY ("revisedFromId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "pricingUnit" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "frequency" TEXT;
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "customFrequency" TEXT;
