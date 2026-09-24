-- Banking: bank CSV import + reconciliation (Finance module, spec sections 15-16).

DO $$ BEGIN
  CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "bank_imports" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_transactions" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "rawRow" JSONB NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedPaymentId" TEXT,
    "matchedExpenseId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_transactions_status_idx" ON "bank_transactions"("status");
CREATE INDEX IF NOT EXISTS "bank_transactions_dedupeHash_idx" ON "bank_transactions"("dedupeHash");
CREATE INDEX IF NOT EXISTS "bank_transactions_importId_idx" ON "bank_transactions"("importId");

DO $$ BEGIN
  ALTER TABLE "bank_imports" ADD CONSTRAINT "bank_imports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedExpenseId_fkey" FOREIGN KEY ("matchedExpenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedById_fkey" FOREIGN KEY ("matchedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
