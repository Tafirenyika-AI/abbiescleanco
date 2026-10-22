-- Workforce: a real link from Booking to TeamMember, parallel to the existing subcontractorId
-- link added for Subcontractor Finance. Lets the real roster compute assigned/completed job
-- counts from a real FK instead of fragile staffAssignee name-matching. Purely additive.

ALTER TABLE "bookings" ADD COLUMN "teamMemberId" TEXT;
CREATE INDEX "bookings_teamMemberId_idx" ON "bookings"("teamMemberId");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
