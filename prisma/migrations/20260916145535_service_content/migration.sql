-- AlterTable
ALTER TABLE "services" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'home',
ADD COLUMN     "details" JSONB,
ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "imageUrl" TEXT;
