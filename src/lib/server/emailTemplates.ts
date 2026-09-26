import { prisma, isDatabaseConfigured } from "@/lib/db";

/**
 * Editable copy for every real email the app sends. Each definition's `defaultSubject`/
 * `defaultHtml` is exactly what used to be hardcoded in email.ts/automation.ts -- converting to
 * this system changes nothing about what actually goes out until an admin edits one. Variables
 * use {{name}} placeholders; the caller is responsible for HTML-escaping any raw user text before
 * putting it in the vars object (matching how every one of these already worked), and for
 * pre-rendering any variable-length block (an optional paragraph, a table's rows) into a single
 * already-safe HTML string variable -- this substitution engine is deliberately simple flat
 * replace, no loops/conditionals, so anything structural is built by the caller, not the template.
 */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export interface EmailTemplateDef {
  key: string;
  name: string;
  description: string;
  variables: string[];
  defaultSubject: string;
  defaultHtml: string;
}

const WRAP_OPEN = `<div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">`;
const WRAP_CLOSE = `</div>`;
const SIGNOFF = `<p style="margin-top:24px;color:#4a5a6a;font-size:14px">{{businessName}} · {{businessCity}}, {{businessRegion}}</p>`;

export const EMAIL_TEMPLATE_DEFS: EmailTemplateDef[] = [
  {
    key: "CUSTOMER_QUOTE_CONFIRMATION",
    name: "Estimate request received (customer)",
    description: "Sent the moment someone submits the public estimate form.",
    variables: ["firstName", "reference", "serviceName", "estimateLabel", "businessPhone", "businessName", "businessCity", "businessRegion"],
    defaultSubject: "We received your estimate request, {{reference}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Thanks, {{firstName}}!</h2>
      <p>We received your request for <strong>{{serviceName}}</strong>.</p>
      <p><strong>Reference number:</strong> {{reference}}</p>
      <p><strong>Preliminary estimate:</strong> {{estimateLabel}}</p>
      <p>This is a preliminary estimate only. A member of our team will follow up to confirm final pricing and your preferred date before anything is booked.</p>
      <p>Questions in the meantime? Call or text us at {{businessPhone}}, or reply to this email.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "BUSINESS_NEW_LEAD_NOTIFICATION",
    name: "New lead alert (internal)",
    description: "Sent to the business inbox, not the customer, whenever a new estimate request comes in.",
    variables: ["leadDetailsListHtml", "reference", "name", "serviceName"],
    defaultSubject: "New lead: {{name}}, {{serviceName}} ({{reference}})",
    defaultHtml: `${WRAP_OPEN}
      <h2>New estimate request</h2>
      <ul>{{leadDetailsListHtml}}</ul>
      <p>Open the admin dashboard to review the full request and respond.</p>
    ${WRAP_CLOSE}`,
  },
  {
    key: "WELCOME",
    name: "Welcome (new account)",
    description: "Sent when a customer creates an account, either by signing up directly or claiming a guest request.",
    variables: ["firstName", "businessName", "businessPhone", "businessCity", "businessRegion"],
    defaultSubject: "Welcome to {{businessName}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Welcome, {{firstName}}!</h2>
      <p>Your account with {{businessName}} is set up. You can sign in any time to track estimate requests, view your booking history, and update your details.</p>
      <p>Questions in the meantime? Call or text us at {{businessPhone}}.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "ADMIN_INVITE",
    name: "Admin invite",
    description: "Sent when a new team member is added as an admin dashboard user.",
    variables: ["name", "loginUrl", "businessName"],
    defaultSubject: "You've been added as an admin, {{businessName}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Hi {{name}},</h2>
      <p>An administrator account was created for you on the {{businessName}} dashboard.</p>
      <p><a href="{{loginUrl}}" style="color:#0d8f83">{{loginUrl}}</a></p>
      <p>Sign in with the email address and password your admin set for you. If you don't know your password, use "Forgot password?" on the sign-in page.</p>
    ${WRAP_CLOSE}`,
  },
  {
    key: "ADMIN_PASSWORD_RESET",
    name: "Admin password reset",
    description: "Sent when an admin requests a password reset link.",
    variables: ["resetUrl"],
    defaultSubject: "Reset your admin password",
    defaultHtml: `${WRAP_OPEN}
      <h2>Reset your admin password</h2>
      <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
      <p><a href="{{resetUrl}}" style="color:#0d8f83">{{resetUrl}}</a></p>
      <p style="color:#4a5a6a;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
    ${WRAP_CLOSE}`,
  },
  {
    key: "QUOTE_SENT",
    name: "Quote sent",
    description: "Sent when an admin sends a customer their quote. The line-item table itself isn't editable here, but everything around it is.",
    variables: ["firstName", "messageBlockHtml", "quoteNumber", "itemsRowsHtml", "expiresBlockHtml", "businessPhone", "businessName", "businessCity", "businessRegion"],
    defaultSubject: "Your quote from {{businessName}}, {{quoteNumber}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Hi {{firstName}},</h2>
      {{messageBlockHtml}}
      <p>Here's your quote <strong>{{quoteNumber}}</strong>:</p>
      <table style="width:100%;border-collapse:collapse">{{itemsRowsHtml}}</table>
      {{expiresBlockHtml}}
      <p>Reply to this email or call/text us at {{businessPhone}} to accept or ask questions.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "PAYMENT_LINK",
    name: "Payment request",
    description: "Sent when an admin generates a Stripe payment link and chooses to email it.",
    variables: ["firstName", "description", "amountLabel", "url", "businessPhone", "businessName", "businessCity", "businessRegion"],
    defaultSubject: "Payment request from {{businessName}}, {{amountLabel}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Hi {{firstName}},</h2>
      <p>{{description}}</p>
      <p style="font-size:20px;font-weight:bold">{{amountLabel}}</p>
      <p style="margin:24px 0">
        <a href="{{url}}" style="display:inline-block;background:#0d8f83;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Pay now</a>
      </p>
      <p style="color:#4a5a6a;font-size:13px">Secure payment powered by Stripe. Card, Apple Pay, and Google Pay are all accepted.</p>
      <p>Questions? Call or text us at {{businessPhone}}.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "BOOKING_REQUEST_RECEIVED",
    name: "Booking request received",
    description: "Sent when a guest requests a self-service booking slot, before it's confirmed.",
    variables: ["firstName", "serviceName", "scheduledStartLabel", "reference", "businessPhone", "businessName", "businessCity", "businessRegion"],
    defaultSubject: "We've got your booking request, {{reference}}",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Thanks, {{firstName}}!</h2>
      <p>We received your request for <strong>{{serviceName}}</strong> on <strong>{{scheduledStartLabel}}</strong>.</p>
      <p><strong>Reference number:</strong> {{reference}}</p>
      <p>This time slot is being held for you, but not confirmed yet. A member of our team will review it shortly and confirm your appointment.</p>
      <p>Questions in the meantime? Call or text us at {{businessPhone}}.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "PAYMENT_RECEIPT",
    name: "Payment receipt",
    description: "Sent whenever a real payment is recorded as paid, whether through Stripe or a manual method.",
    variables: ["firstName", "description", "amountLabel", "methodBlockHtml", "receiptBlockHtml", "businessPhone", "businessName", "businessCity", "businessRegion"],
    defaultSubject: "{{businessName}}: payment received ({{amountLabel}})",
    defaultHtml: `${WRAP_OPEN}
      <h2 style="color:#0b1f33">Thanks, {{firstName}}!</h2>
      <p>We've received your payment for {{description}}.</p>
      <p style="font-size:20px;font-weight:bold">{{amountLabel}}</p>
      {{methodBlockHtml}}
      {{receiptBlockHtml}}
      <p>Questions? Call or text us at {{businessPhone}}.</p>
      ${SIGNOFF}
    ${WRAP_CLOSE}`,
  },
  {
    key: "QUOTE_FOLLOW_UP_1",
    name: "Quote follow-up (first)",
    description: "Sent automatically if a quote goes unanswered for a while.",
    variables: ["name", "reference", "businessPhone"],
    defaultSubject: "Still interested? Your estimate {{reference}} is waiting",
    defaultHtml: `<p>Hi {{name}}, just checking in on your cleaning estimate ({{reference}}). Reply here or call/text {{businessPhone}} whenever works for you.</p>`,
  },
  {
    key: "QUOTE_FOLLOW_UP_2",
    name: "Quote follow-up (final)",
    description: "Sent once more if the first follow-up goes unanswered too -- the last one for this quote.",
    variables: ["name", "reference"],
    defaultSubject: "Last check-in on estimate {{reference}}",
    defaultHtml: `<p>Hi {{name}}, we'll close out this estimate soon unless we hear from you. No worries either way, just reply or reach out if you'd like to move forward.</p>`,
  },
  {
    key: "BOOKING_CONFIRMATION",
    name: "Booking confirmed",
    description: "Sent the moment an admin confirms a booking.",
    variables: ["name", "serviceName", "dateLabel", "arrivalWindowBlockHtml", "reference", "cancellationUrl"],
    defaultSubject: "Your {{serviceName}} visit is confirmed, {{dateLabel}}",
    defaultHtml: `
      <p>Hi {{name}}, your {{serviceName}} visit is confirmed for {{dateLabel}}{{arrivalWindowBlockHtml}}.</p>
      <p>Reference: {{reference}}. Need to reschedule? See our <a href="{{cancellationUrl}}">Cancellation &amp; Rescheduling Policy</a>.</p>
    `,
  },
  {
    key: "APPOINTMENT_REMINDER",
    name: "Appointment reminder",
    description: "Sent 48 hours, 24 hours, and the day of an upcoming booking -- same wording every time.",
    variables: ["name", "serviceName", "dateLabel"],
    defaultSubject: "Reminder: {{serviceName}} on {{dateLabel}}",
    defaultHtml: `<p>Hi {{name}}, this is a reminder about your upcoming {{serviceName}} visit on {{dateLabel}}.</p>`,
  },
  {
    key: "ON_THE_WAY",
    name: "Cleaner on the way",
    description: "Sent the instant an admin marks a booking ON_THE_WAY.",
    variables: ["name", "serviceName"],
    defaultSubject: "Your {{serviceName}} cleaner is on the way",
    defaultHtml: `<p>Hi {{name}}, good news -- your {{serviceName}} cleaner is on the way now.</p>`,
  },
  {
    key: "POST_SERVICE_FOLLOWUP",
    name: "Post-service follow-up",
    description: "Sent a couple hours after a job is marked complete, asking how it went.",
    variables: ["name", "businessName"],
    defaultSubject: "How did we do?",
    defaultHtml: `
      <p>Hi {{name}}, thank you for choosing {{businessName}}! We'd love to know how your cleaning went.</p>
      <p>If everything was great, we'd be grateful for a review. If anything fell short, please reply here directly so we can make it right, no public link needed.</p>
    `,
  },
  {
    key: "REVIEW_REQUEST",
    name: "Review request",
    description: "Sent only to customers who confirmed they were satisfied -- links to the real public review page.",
    variables: ["publicReviewUrl"],
    defaultSubject: "Would you share a quick review?",
    defaultHtml: `<p>So glad it went well! If you have a minute, a review helps other Spokane Valley families find us: <a href="{{publicReviewUrl}}">{{publicReviewUrl}}</a>. Totally optional, and thank you either way.</p>`,
  },
  {
    key: "WIN_BACK",
    name: "Win-back",
    description: "Respectful re-engagement for customers inactive past a configurable period. Off by default until a business turns it on.",
    variables: ["name"],
    defaultSubject: "We'd love to clean for you again",
    defaultHtml: `<p>Hi {{name}}, it's been a while! If you'd like to get back on the schedule, just reply or request a new estimate. If you'd rather not hear from us again, reply "unsubscribe" and we'll stop.</p>`,
  },
];

const DEFS_BY_KEY = new Map(EMAIL_TEMPLATE_DEFS.map((d) => [d.key, d]));

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (full, name: string) => (name in vars ? vars[name] : full));
}

/**
 * Real content used for a send: an admin's saved edit if one exists, otherwise the built-in
 * default -- so this table only ever needs rows for templates someone has actually customized.
 */
export async function renderEmailTemplate(key: string, vars: Record<string, string>): Promise<{ subject: string; html: string }> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown email template key: ${key}`);
  let subject = def.defaultSubject;
  let html = def.defaultHtml;

  if (isDatabaseConfigured && prisma) {
    const row = await prisma.emailTemplate.findUnique({ where: { key } });
    if (row) {
      subject = row.subject;
      html = row.html;
    }
  }
  return { subject: substitute(subject, vars), html: substitute(html, vars) };
}

export interface EmailTemplateListItem {
  key: string;
  name: string;
  description: string;
  variables: string[];
  subject: string;
  html: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

export async function listEmailTemplates(): Promise<EmailTemplateListItem[]> {
  const rows = isDatabaseConfigured && prisma ? await prisma.emailTemplate.findMany({ include: { updatedBy: { select: { name: true } } } }) : [];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return EMAIL_TEMPLATE_DEFS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      variables: def.variables,
      subject: row?.subject ?? def.defaultSubject,
      html: row?.html ?? def.defaultHtml,
      isCustomized: !!row,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedByName: row?.updatedBy?.name ?? null,
    };
  });
}

export async function saveEmailTemplate(key: string, subject: string, html: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) return { ok: false, error: "Unknown template" };
  if (!isDatabaseConfigured || !prisma) return { ok: false, error: "Database not configured" };

  await prisma.emailTemplate.upsert({
    where: { key },
    update: { subject, html, updatedById: adminUserId },
    create: { key, subject, html, updatedById: adminUserId },
  });
  await prisma.auditLog.create({ data: { adminUserId, action: "email_template.updated", entityType: "EmailTemplate", entityId: key } });
  return { ok: true };
}

/** Reverts to the built-in default by deleting the saved override. */
export async function resetEmailTemplate(key: string, adminUserId: string): Promise<{ ok: boolean; error?: string }> {
  if (!DEFS_BY_KEY.has(key)) return { ok: false, error: "Unknown template" };
  if (!isDatabaseConfigured || !prisma) return { ok: false, error: "Database not configured" };

  await prisma.emailTemplate.deleteMany({ where: { key } });
  await prisma.auditLog.create({ data: { adminUserId, action: "email_template.reset", entityType: "EmailTemplate", entityId: key } });
  return { ok: true };
}
