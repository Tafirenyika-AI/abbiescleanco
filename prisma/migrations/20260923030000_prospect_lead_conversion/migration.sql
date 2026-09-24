-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "convertedLeadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "prospects_convertedLeadId_key" ON "prospects"("convertedLeadId");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_convertedLeadId_fkey" FOREIGN KEY ("convertedLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
