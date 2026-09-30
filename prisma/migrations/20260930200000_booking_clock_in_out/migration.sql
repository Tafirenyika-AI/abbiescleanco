-- Additive only. Real clock-in/clock-out times for a booking (separate from the planned
-- scheduledStart/scheduledEnd calendar window), plus dedupe flags for the time-tracking reminder
-- cron, plus a new admin-notification type for those reminders.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "actualStart" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "actualEnd" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "clockInReminderSentAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "finishReminderSentAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "clockOutReminderSentAt" TIMESTAMP(3);
ALTER TYPE "AdminNotificationType" ADD VALUE IF NOT EXISTS 'TIME_TRACKING';
