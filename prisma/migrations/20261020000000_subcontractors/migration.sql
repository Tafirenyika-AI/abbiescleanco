-- Subcontractor Finance: a real Subcontractor entity, linked from Booking (alongside the
-- existing free-text staffAssignee, which stays in sync) and Expense (for real payouts).
-- Purely additive.

CREATE TYPE "SubcontractorPayType" AS ENUM ('PER_JOB', 'HOURLY', 'PERCENTAGE', 'FLAT_MONTHLY');
CREATE TYPE "SubcontractorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "subcontractors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "payType" "SubcontractorPayType" NOT NULL DEFAULT 'PER_JOB',
  "payRateCents" INTEGER NOT NULL DEFAULT 0,
  "payRatePercent" INTEGER,
  "taxIdLast4" TEXT,
  "status" "SubcontractorStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subcontractors_status_idx" ON "subcontractors"("status");

ALTER TABLE "bookings" ADD COLUMN "subcontractorId" TEXT;
CREATE INDEX "bookings_subcontractorId_idx" ON "bookings"("subcontractorId");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD COLUMN "subcontractorId" TEXT;
CREATE INDEX "expenses_subcontractorId_idx" ON "expenses"("subcontractorId");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
