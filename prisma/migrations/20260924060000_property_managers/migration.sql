-- Property managers module: flag a customer as managing multiple properties, and let each of
-- their properties carry an optional nickname (e.g. "Unit 4B") for a real portfolio view.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isPropertyManager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "label" TEXT;
