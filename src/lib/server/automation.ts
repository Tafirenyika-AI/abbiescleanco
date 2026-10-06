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
 * yet (follow-up timing, reminder offsets, re-clean window -- see
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
 *
 * The real subject/html for every email here is editable (see
 * src/lib/server/emailTemplates.ts and /admin/settings/email-templates) --
 * this file's only job is to gather the real variables and call
 * renderEmailTemplate(), never to hardcode wording itself.
 */

import { sendEmail, type SendEmailResult } from "./email";
import { sendCustomerSms } from "./sms";
import { renderEmailTemplate, escapeHtml } from "./emailTemplates";
import { business } from "@/lib/data/business";

interface RecipientInfo {
  name: string;
  email: string | null; // a real client with no email (not tech-savvy) has nothing to send here -- see the skipped() guard below
  phone: string;
  smsConsent: boolean;
  customerId?: string | null;
}

// Every date shown to a customer must be computed in the business's own Pacific timezone, not
// whichever timezone the server happens to run in (Vercel = UTC) -- same reasoning as
// adminDate.ts/BUSINESS_TZ, duplicated here rather than imported since that file's formats are
// tuned for the terser admin UI, not a customer-facing sentence.
const BUSINESS_TZ = "America/Los_Angeles";

function dateOnlyLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, weekday: "long", month: "long", day: "numeric" }).format(date);
}

function timeOnlyLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" }).format(date);
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Honest no-op for a recipient with no email -- same {ok:true} shape as a real send, so callers
 *  checking .ok keep working correctly instead of treating "nothing to send to" as a failure. */
function skipped(): SendEmailResult {
  return { ok: true, mode: "skipped" };
}

/** Sent once, shortly after QUOTE_FOLLOW_UP delay, if a quote hasn't been confirmed. */
export async function sendQuoteFollowUp(recipient: RecipientInfo, reference: string) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("QUOTE_FOLLOW_UP_1", {
    name: escapeHtml(recipient.name),
    reference: escapeHtml(reference),
    businessPhone: business.phoneDisplay,
  });
  return sendEmail({ to: recipient.email, subject, html });
}

/** Sent once more if the first follow-up went unanswered. Stops after this. */
export async function sendFinalQuoteFollowUp(recipient: RecipientInfo, reference: string) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("QUOTE_FOLLOW_UP_2", {
    name: escapeHtml(recipient.name),
    reference: escapeHtml(reference),
  });
  return sendEmail({ to: recipient.email, subject, html });
}

/** Sent when an administrator confirms a booking. */
export async function sendBookingConfirmation(
  recipient: RecipientInfo,
  details: { serviceName: string; scheduledStart: Date; arrivalWindow?: string; reference: string; address?: string | null; amount?: number | null }
) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("BOOKING_CONFIRMATION", {
    name: escapeHtml(recipient.name),
    serviceName: escapeHtml(details.serviceName),
    dateLabel: dateOnlyLabel(details.scheduledStart),
    timeLabel: timeOnlyLabel(details.scheduledStart),
    arrivalWindowBlockHtml: details.arrivalWindow ? ` (${escapeHtml(details.arrivalWindow)})` : "",
    reference: escapeHtml(details.reference),
    cancellationUrl: `${siteUrl()}/policies/cancellation`,
    addressBlockHtml: details.address ? `<p><strong>Address:</strong> ${escapeHtml(details.address)}</p>` : "",
    amountBlockHtml: details.amount ? `<p><strong>Price:</strong> ${money(details.amount)}</p>` : "",
  });
  return sendEmail({ to: recipient.email, subject, html });
}

/** 48h / 24h / day-of reminder -- same content, different offset (offset is a scheduling concern, not this function's). */
export async function sendAppointmentReminder(
  recipient: RecipientInfo,
  details: { serviceName: string; scheduledStart: Date; stage: "48h" | "24h" | "day-of"; address?: string | null }
) {
  const dateLabel = `${dateOnlyLabel(details.scheduledStart)} at ${timeOnlyLabel(details.scheduledStart)}`;
  // Unlike the other, email-only functions here, a reminder can still go out over SMS alone for a
  // customer with no email on file -- only skip the email channel itself, not the whole reminder.
  const results = recipient.email
    ? [
        await (async () => {
          const { subject, html } = await renderEmailTemplate("APPOINTMENT_REMINDER", {
            name: escapeHtml(recipient.name),
            serviceName: escapeHtml(details.serviceName),
            dateLabel,
            addressBlockHtml: details.address ? `<p><strong>Address:</strong> ${escapeHtml(details.address)}</p>` : "",
          });
          return sendEmail({ to: recipient.email!, subject, html });
        })(),
      ]
    : [];
  if (recipient.smsConsent) {
    results.push(
      await sendCustomerSms({
        to: recipient.phone,
        body: `${business.name}: Reminder: your ${details.serviceName} visit is ${dateLabel}. Reply STOP to opt out.`,
        category: "reminder",
        customerId: recipient.customerId,
      })
    );
  }
  return results;
}

/** Sent the moment an admin marks a booking ON_THE_WAY -- immediate, not scheduled, since there's
 *  no delay concept for "right now". Same dual-channel pattern as the appointment reminder. */
export async function sendOnTheWayNotice(recipient: RecipientInfo, details: { serviceName: string }) {
  const results = recipient.email
    ? [
        await (async () => {
          const { subject, html } = await renderEmailTemplate("ON_THE_WAY", {
            name: escapeHtml(recipient.name),
            serviceName: escapeHtml(details.serviceName),
          });
          return sendEmail({ to: recipient.email!, subject, html });
        })(),
      ]
    : [];
  if (recipient.smsConsent) {
    results.push(
      await sendCustomerSms({
        to: recipient.phone,
        body: `${business.name}: Good news -- your ${details.serviceName} cleaner is on the way!`,
        category: "arrival_update",
        customerId: recipient.customerId,
      })
    );
  }
  return results;
}

/** Sent after a job is marked complete. */
export async function sendPostServiceFollowUp(recipient: RecipientInfo) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("POST_SERVICE_FOLLOWUP", {
    name: escapeHtml(recipient.name),
    businessName: business.name,
  });
  return sendEmail({ to: recipient.email, subject, html });
}

/** Sent only to customers who confirm satisfaction -- points to the client-approved public review link. */
export async function sendReviewRequest(recipient: RecipientInfo, publicReviewUrl: string) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("REVIEW_REQUEST", { publicReviewUrl });
  return sendEmail({ to: recipient.email, subject, html });
}

/** Respectful re-engagement for customers inactive past a configurable period. Must honor opt-outs. */
export async function sendWinBackMessage(recipient: RecipientInfo) {
  if (!recipient.email) return skipped();
  const { subject, html } = await renderEmailTemplate("WIN_BACK", { name: escapeHtml(recipient.name) });
  return sendEmail({ to: recipient.email, subject, html });
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.com";
}
