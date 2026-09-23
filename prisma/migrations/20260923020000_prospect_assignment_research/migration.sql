-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "researchNotes" TEXT,
ADD COLUMN     "researchSources" JSONB,
ADD COLUMN     "researchedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
