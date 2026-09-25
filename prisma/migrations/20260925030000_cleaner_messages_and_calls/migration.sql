-- Real two-way messaging and masked-number call bridging between customer and cleaner.
-- Additive only.
ALTER TABLE "cleaner_location_shares" ADD COLUMN "phone" TEXT;

CREATE TABLE "cleaner_messages" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleaner_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cleaner_messages_bookingId_idx" ON "cleaner_messages"("bookingId");
ALTER TABLE "cleaner_messages" ADD CONSTRAINT "cleaner_messages_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "call_bridges" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "targetPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_bridges_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "call_bridges" ADD CONSTRAINT "call_bridges_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
