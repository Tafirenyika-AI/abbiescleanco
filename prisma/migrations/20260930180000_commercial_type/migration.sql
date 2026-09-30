-- Additive only: lets a commercial property request say what kind it is (church, school, office,
-- retail, etc.) instead of every non-residential lead being one undifferentiated "commercial" bucket.
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "commercialType" TEXT;
