-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "dedupFingerprint" TEXT;

-- CreateIndex
CREATE INDEX "leads_dedupFingerprint_idx" ON "leads"("dedupFingerprint");
