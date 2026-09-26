/**
 * Client-safe automation types/constants -- no server-only imports (Prisma, email/SMS senders).
 * automationStore.ts imports nodemailer transitively (via ./automation -> ./email for the SMTP
 * send path), which broke the client bundle the moment a "use client" component imported these
 * from automationStore.ts directly -- same class of bug already hit and fixed once before for
 * leadStore.ts/lib/leads.ts, see docs/DECISIONS.md.
 */

/** The subset of AutomationEventType that's scheduled/processed by the cron loop. NEW_LEAD fires synchronously in /api/quote; REVIEW_REQUEST is admin-triggered by a button, not time-based; RECURRING_ENROLLMENT has no feature to hang off yet. */
export const CONFIGURABLE_AUTOMATION_TYPES = [
  "QUOTE_FOLLOW_UP_1",
  "QUOTE_FOLLOW_UP_2",
  "BOOKING_CONFIRMATION",
  "REMINDER_48H",
  "REMINDER_24H",
  "REMINDER_DAY_OF",
  "POST_SERVICE_THANK_YOU",
  "WIN_BACK",
] as const;
export type ConfigurableAutomationType = (typeof CONFIGURABLE_AUTOMATION_TYPES)[number];

export interface AutomationRuleConfig {
  enabled: boolean;
  /** Hours after the triggering event for time-delayed types; days-of-inactivity for WIN_BACK. Ignored by the fixed-offset reminder/confirmation types. */
  offsetHours?: number;
}
export type AutomationRules = Record<ConfigurableAutomationType, AutomationRuleConfig>;

export const automationRuleLabels: Record<ConfigurableAutomationType, string> = {
  QUOTE_FOLLOW_UP_1: "First quote follow-up",
  QUOTE_FOLLOW_UP_2: "Second (final) quote follow-up",
  BOOKING_CONFIRMATION: "Booking confirmation",
  REMINDER_48H: "48-hour appointment reminder",
  REMINDER_24H: "24-hour appointment reminder",
  REMINDER_DAY_OF: "Day-of appointment reminder",
  POST_SERVICE_THANK_YOU: "Post-service thank-you",
  WIN_BACK: "Win-back re-engagement",
};
