-- Finance module, Phase 1. All additive -- no existing column dropped or renamed except
-- invoices.status, whose real per-row value is backfilled from live payment data by a follow-up
-- Node script (see project convention), not guessed in SQL.

-- AlterEnum: AdminPermission (9 new finance.* permissions)
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_VIEW';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_MANAGE';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_EXPENSES';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_PAYMENTS';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_SUBCONTRACTORS';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_DOCUMENTS';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_TAX_RECORDS';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_REFUNDS';
ALTER TYPE "AdminPermission" ADD VALUE IF NOT EXISTS 'FINANCE_ADMIN';

-- AlterEnum: ExpenseCategory (finer-grained categories, additive)
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'FUEL';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'VEHICLE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'SUBCONTRACTORS';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'EMPLOYEE_COSTS';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'OFFICE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_SERVICES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'BANK_FEES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PAYMENT_PROCESSING';

-- AlterTable: payments (refund/tip/fee/provider tracking)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tipAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processingFeeAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;

-- AlterTable: expenses (link to the job that generated the cost)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
CREATE INDEX IF NOT EXISTS "expenses_bookingId_idx" ON "expenses"("bookingId");
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: InvoiceStatus, replacing invoices.status's old free-text ISSUED/VOID convention
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: invoices.status becomes the new enum. Add as a new column first (old text column
-- kept temporarily as "statusLegacy" so the backfill script can read old values); the backfill
-- script computes each invoice's REAL status from its linked payments, then this migration's
-- second half (run by the same backfill script) drops statusLegacy and enforces NOT NULL.
ALTER TABLE "invoices" RENAME COLUMN "status" TO "statusLegacy";
DROP INDEX IF EXISTS "invoices_status_idx";
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus";

-- Grant FINANCE_VIEW to every admin who already has VIEW_REPORTS, so nobody loses access to the
-- Payments/Invoices/Expenses pages they can already see today once those pages' gate changes.
UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'FINANCE_VIEW'::"AdminPermission")
WHERE 'VIEW_REPORTS'::"AdminPermission" = ANY("permissions")
  AND NOT ('FINANCE_VIEW'::"AdminPermission" = ANY("permissions"));
