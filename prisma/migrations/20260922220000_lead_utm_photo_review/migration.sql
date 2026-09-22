-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "referrer" TEXT;

-- AlterTable
ALTER TABLE "photo_estimates" ADD COLUMN     "customerApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerNotes" TEXT;
