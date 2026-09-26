/**
 * Client-safe booking status constants -- no server-only imports. bookingStore.ts imports
 * automationStore.ts (which now transitively imports nodemailer via automation.ts -> email.ts's
 * SMTP path), which broke the client bundle the moment a "use client" component imported a
 * plain value (not just a type) from bookingStore.ts directly -- same class of bug already fixed
 * for leadStore.ts/lib/leads.ts and automationStore.ts/lib/automations.ts, see docs/DECISIONS.md.
 */
export const BOOKING_STATUSES = ["REQUESTED", "CONFIRMED", "SCHEDULED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;
export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

export const bookingStatusLabels: Record<BookingStatusValue, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  ON_THE_WAY: "On the way",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RESCHEDULED: "Rescheduled",
};
