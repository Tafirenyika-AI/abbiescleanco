/**
 * Automation architecture.
 *
 * Each function below represents one automation event from the project
 * spec, mapped 1:1 to the `AutomationEventType` enum in prisma/schema.prisma
 * and the `automation_events` table. `NEW_LEAD` is already wired up
 * synchronously in src/app/api/quote/route.ts (confirmation + notification
 * emails fire immediately on submit).
 *
 * The rest (follow-ups, reminders, post-service, recurring, win-back) are
 * time-delayed and depend on business decisions the client hasn't confirmed
 * yet (follow-up timing, reminder offsets, re-clean window — see
 * CLIENT_CONFIRMATION_CHECKLIST.md), so they're implemented as pure,
 * independently-testable functions here rather than wired to a live
 * scheduler. To activate them in production:
 *
 *   1. Confirm timing values in `business_settings` (or hardcode once approved).
 *   2. Add a Vercel Cron job (vercel.json) hitting a new
 *      `/api/automation/process` route on a schedule (e.g. every 15 min).
 *   3. That route should query `automation_events` for due, PENDING rows
 *      (scheduledFor <= now) and call the matching function below for each,
 *      then mark the row SENT/FAILED.
 *
 * This keeps the actual send logic decoupled from *when* it runs, so it's
 * unit-testable without a real scheduler.
 */

import { sendEmail, type SendEmailResult } from "./email";
import { sendSms } from "./sms";
import { business } from "@/lib/data/business";

interface RecipientInfo {
  name: string;
  email: string | null; // a real client with no email (not tech-savvy) has nothing to send here -- see the skipped() guard below
  phone: string;
  smsConsent: boolean;
}

/** Honest no-op for a recipient with no email -- same {ok:true} shape as a real send, so callers
 *  checking .ok keep working correctly instead of treating "nothing to send to" as a failure. */
function skipped(): SendEmailResult {
  return { ok: true, mode: "skipped" };
}

/** Sent once, shortly after QUOTE_FOLLOW_UP delay, if a quote hasn't been confirmed. */
export async function sendQuoteFollowUp(recipient: RecipientInfo, reference: string) {
  if (!recipient.email) return skipped();
  return sendEmail({
    to: recipient.email,
    subject: `Still interested? Your estimate ${reference} is waiting`,
    html: `<p>Hi ${escapeHtml(recipient.name)}, just checking in on your cleaning estimate (${escapeHtml(
      reference
    )}). Reply here or call/text ${business.phoneDisplay} whenever works for you.</p>`,
  });
}

/** Sent once more if the first follow-up went unanswered. Stops after this. */
export async function sendFinalQuoteFollowUp(recipient: RecipientInfo, reference: string) {
  if (!recipient.email) return skipped();
  return sendEmail({
    to: recipient.email,
    subject: `Last check-in on estimate ${reference}`,
    html: `<p>Hi ${escapeHtml(
      recipient.name
    )}, we'll close out this estimate soon unless we hear from you. No worries either way, just reply or reach out if you'd like to move forward.</p>`,
  });
}

/** Sent when an administrator confirms a booking. */
export async function sendBookingConfirmation(
  recipient: RecipientInfo,
  details: { serviceName: string; scheduledStart: Date; arrivalWindow?: string; reference: string }
) {
  if (!recipient.email) return skipped();
  const dateLabel = details.scheduledStart.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return sendEmail({
    to: recipient.email,
    subject: `Your ${details.serviceName} visit is confirmed, ${dateLabel}`,
    html: `
      <p>Hi ${escapeHtml(recipient.name)}, your ${escapeHtml(details.serviceName)} visit is confirmed for
      ${dateLabel}${details.arrivalWindow ? ` (${escapeHtml(details.arrivalWindow)})` : ""}.</p>
      <p>Reference: ${escapeHtml(details.reference)}. Need to reschedule?
      See our <a href="${siteUrl()}/policies/cancellation">Cancellation &amp; Rescheduling Policy</a>.</p>
    `,
  });
}

/** 48h / 24h / day-of reminder — same content, different offset (offset is a scheduling concern, not this function's). */
export async function sendAppointmentReminder(
  recipient: RecipientInfo,
  details: { serviceName: string; scheduledStart: Date; stage: "48h" | "24h" | "day-of" }
) {
  const dateLabel = details.scheduledStart.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
  // Unlike the other, email-only functions here, a reminder can still go out over SMS alone for a
  // customer with no email on file -- only skip the email channel itself, not the whole reminder.
  const results = recipient.email
    ? [
        await sendEmail({
          to: recipient.email,
          subject: `Reminder: ${details.serviceName} on ${dateLabel}`,
          html: `<p>Hi ${escapeHtml(recipient.name)}, this is a reminder about your upcoming ${escapeHtml(
            details.serviceName
          )} visit on ${dateLabel}.</p>`,
        }),
      ]
    : [];
  if (recipient.smsConsent) {
    results.push(
      await sendSms(recipient.phone, `Reminder: your ${details.serviceName} visit is ${dateLabel}. Reply STOP to opt out.`)
    );
  }
  return results;
}

/** Sent after a job is marked complete. */
export async function sendPostServiceFollowUp(recipient: RecipientInfo) {
  if (!recipient.email) return skipped();
  return sendEmail({
    to: recipient.email,
    subject: "How did we do?",
    html: `
      <p>Hi ${escapeHtml(recipient.name)}, thank you for choosing ${business.name}! We'd love to know
      how your cleaning went.</p>
      <p>If everything was great, we'd be grateful for a review. If anything fell short, please reply
      here directly so we can make it right, no public link needed.</p>
    `,
  });
}

/** Sent only to customers who confirm satisfaction — points to the client-approved public review link. */
export async function sendReviewRequest(recipient: RecipientInfo, publicReviewUrl: string) {
  if (!recipient.email) return skipped();
  return sendEmail({
    to: recipient.email,
    subject: "Would you share a quick review?",
    html: `<p>So glad it went well! If you have a minute, a review helps other Spokane Valley
      families find us: <a href="${publicReviewUrl}">${publicReviewUrl}</a>. Totally optional, and
      thank you either way.</p>`,
  });
}

/** Respectful re-engagement for customers inactive past a configurable period. Must honor opt-outs. */
export async function sendWinBackMessage(recipient: RecipientInfo) {
  if (!recipient.email) return skipped();
  return sendEmail({
    to: recipient.email,
    subject: "We'd love to clean for you again",
    html: `<p>Hi ${escapeHtml(recipient.name)}, it's been a while! If you'd like to get back on the
      schedule, just reply or request a new estimate. If you'd rather not hear from us again, reply
      "unsubscribe" and we'll stop.</p>`,
  });
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.com";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
