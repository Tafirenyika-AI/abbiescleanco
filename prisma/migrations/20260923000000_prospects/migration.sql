-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "businessName" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "website" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google_places',
    "sourcePlaceId" TEXT,
    "sourceQuery" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "draftSubject" TEXT,
    "draftBody" TEXT,
    "notes" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prospects_sourcePlaceId_key" ON "prospects"("sourcePlaceId");

-- CreateIndex
CREATE INDEX "prospects_status_idx" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "prospects_category_idx" ON "prospects"("category");
