-- Customer-acquisition brief, Phase 2 (keyword opportunity engine + attribution capture).
-- Additive only: new nullable Lead columns, a new table, two new enums.

ALTER TABLE "leads" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "leads" ADD COLUMN "gclid" TEXT;

CREATE TYPE "KeywordCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');
CREATE TYPE "KeywordPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "keyword_opportunities" (
  "id" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "category" "KeywordCategory" NOT NULL,
  "intent" TEXT,
  "priority" "KeywordPriority" NOT NULL DEFAULT 'MEDIUM',
  "reasoning" TEXT,
  "searchVolume" INTEGER,
  "cpcCents" INTEGER,
  "competition" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual_import',
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "keyword_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "keyword_opportunities_keyword_key" ON "keyword_opportunities"("keyword");
CREATE INDEX "keyword_opportunities_category_idx" ON "keyword_opportunities"("category");
CREATE INDEX "keyword_opportunities_priority_idx" ON "keyword_opportunities"("priority");
