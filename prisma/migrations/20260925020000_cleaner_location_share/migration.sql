-- Real, time-boxed "share my live location for this job" sessions -- not a persistent cleaner
-- login/account. Additive only.
CREATE TABLE "cleaner_location_shares" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastAccuracyMeters" DOUBLE PRECISION,
    "lastUpdatedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "cleaner_location_shares_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cleaner_location_shares_bookingId_idx" ON "cleaner_location_shares"("bookingId");

ALTER TABLE "cleaner_location_shares" ADD CONSTRAINT "cleaner_location_shares_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cleaner_location_shares" ADD CONSTRAINT "cleaner_location_shares_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
