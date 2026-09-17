import { Resend } from "resend";
import { business } from "@/lib/data/business";
import { getIntegrationValue } from "@/lib/server/integrationSettings";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  mode: "live" | "mock";
  id?: string;
  error?: string;
}

/**
 * Sends transactional email via Resend once a key is configured — from
 * /admin/settings (checked first) or RESEND_API_KEY (fallback). Falls back
 * to a logged "mock send" so the full lead/quote flow can be exercised
 * without a live email provider. See .env.example.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendApiKey = await getIntegrationValue("resendApiKey", "RESEND_API_KEY");
  if (!resendApiKey) {
    console.info(`[mock email] to=${input.to} subject="${input.subject}"`);
    return { ok: true, mode: "mock" };
  }
  const fromAddress = (await getIntegrationValue("emailFrom", "EMAIL_FROM")) || "Abbie's Clean Method <onboarding@resend.dev>";
  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    if (error) return { ok: false, mode: "live", error: error.message };
    return { ok: true, mode: "live", id: data?.id };
  } catch (err) {
    return { ok: false, mode: "live", error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

export function customerConfirmationEmail(params: {
  firstName: string;
  reference: string;
  serviceName: string;
  estimateLabel: string;
}) {
  const { firstName, reference, serviceName, estimateLabel } = params;
  return {
    subject: `We received your estimate request — ${reference}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Thanks, ${escapeHtml(firstName)}!</h2>
        <p>We received your request for <strong>${escapeHtml(serviceName)}</strong>.</p>
        <p><strong>Reference number:</strong> ${escapeHtml(reference)}</p>
        <p><strong>Preliminary estimate:</strong> ${escapeHtml(estimateLabel)}</p>
        <p>This is a preliminary estimate only. A member of our team will follow up to confirm final pricing and your preferred date before anything is booked.</p>
        <p>Questions in the meantime? Call or text us at ${business.phoneDisplay}, or reply to this email.</p>
        <p style="margin-top:24px;color:#4a5a6a;font-size:14px">${business.name} · ${business.city}, ${business.region}</p>
      </div>
    `,
  };
}

export function businessNotificationEmail(params: {
  reference: string;
  name: string;
  phone: string;
  email: string;
  serviceName: string;
  estimateLabel: string;
  preferredContactMethod: string;
  zip: string;
}) {
  const { reference, name, phone, email, serviceName, estimateLabel, preferredContactMethod, zip } = params;
  return {
    subject: `New lead: ${name} — ${serviceName} (${reference})`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2>New estimate request</h2>
        <ul>
          <li><strong>Reference:</strong> ${escapeHtml(reference)}</li>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(phone)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          <li><strong>ZIP:</strong> ${escapeHtml(zip)}</li>
          <li><strong>Service:</strong> ${escapeHtml(serviceName)}</li>
          <li><strong>Preliminary estimate:</strong> ${escapeHtml(estimateLabel)}</li>
          <li><strong>Preferred contact:</strong> ${escapeHtml(preferredContactMethod)}</li>
        </ul>
        <p>Open the admin dashboard to review the full request and respond.</p>
      </div>
    `,
  };
}

export function welcomeEmail(params: { firstName: string }) {
  return {
    subject: `Welcome to ${business.name}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Welcome, ${escapeHtml(params.firstName)}!</h2>
        <p>Your account with ${escapeHtml(business.name)} is set up. You can sign in any time to track estimate requests, view your booking history, and update your details.</p>
        <p>Questions in the meantime? Call or text us at ${business.phoneDisplay}.</p>
        <p style="margin-top:24px;color:#4a5a6a;font-size:14px">${business.name} · ${business.city}, ${business.region}</p>
      </div>
    `,
  };
}

export function adminInviteEmail(params: { name: string; loginUrl: string }) {
  return {
    subject: `You've been added as an admin — ${business.name}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Hi ${escapeHtml(params.name)},</h2>
        <p>An administrator account was created for you on the ${escapeHtml(business.name)} dashboard.</p>
        <p><a href="${params.loginUrl}" style="color:#0d8f83">${params.loginUrl}</a></p>
        <p>Sign in with the email address and password your admin set for you. If you don't know your password, use "Forgot password?" on the sign-in page.</p>
      </div>
    `,
  };
}

export function adminPasswordResetEmail(params: { resetUrl: string }) {
  return {
    subject: "Reset your admin password",
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:480px;margin:0 auto">
        <h2>Reset your admin password</h2>
        <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
        <p><a href="${params.resetUrl}" style="color:#0d8f83">${params.resetUrl}</a></p>
        <p style="color:#4a5a6a;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

export function quoteEmail(params: {
  firstName: string;
  quoteNumber: string;
  items: { label: string; quantity: number; unitPrice: number; total: number }[];
  discount: number;
  tax: number;
  deposit: number;
  total: number;
  expiresAt: string | null;
  message?: string;
}) {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const rows = params.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.label)} ${i.quantity > 1 ? `× ${i.quantity}` : ""}</td><td style="padding:6px 0;text-align:right">${money(i.total)}</td></tr>`
    )
    .join("");
  return {
    subject: `Your quote from ${business.name} — ${params.quoteNumber}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Hi ${escapeHtml(params.firstName)},</h2>
        ${params.message ? `<p>${escapeHtml(params.message)}</p>` : ""}
        <p>Here's your quote <strong>${escapeHtml(params.quoteNumber)}</strong>:</p>
        <table style="width:100%;border-collapse:collapse">
          ${rows}
          ${params.discount ? `<tr><td style="padding:6px 0">Discount</td><td style="padding:6px 0;text-align:right">-${money(params.discount)}</td></tr>` : ""}
          ${params.tax ? `<tr><td style="padding:6px 0">Tax</td><td style="padding:6px 0;text-align:right">${money(params.tax)}</td></tr>` : ""}
          <tr style="border-top:1px solid #e2e8f0;font-weight:bold"><td style="padding:8px 0">Total</td><td style="padding:8px 0;text-align:right">${money(params.total)}</td></tr>
          ${params.deposit ? `<tr><td style="padding:6px 0">Deposit due to confirm</td><td style="padding:6px 0;text-align:right">${money(params.deposit)}</td></tr>` : ""}
        </table>
        ${params.expiresAt ? `<p style="color:#4a5a6a;font-size:13px">This quote is valid until ${new Date(params.expiresAt).toLocaleDateString()}.</p>` : ""}
        <p>Reply to this email or call/text us at ${business.phoneDisplay} to accept or ask questions.</p>
        <p style="margin-top:24px;color:#4a5a6a;font-size:14px">${business.name} · ${business.city}, ${business.region}</p>
      </div>
    `,
  };
}

export function paymentLinkEmail(params: { firstName: string; amountLabel: string; description: string; url: string }) {
  return {
    subject: `Payment request from ${business.name} — ${params.amountLabel}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Hi ${escapeHtml(params.firstName)},</h2>
        <p>${escapeHtml(params.description)}</p>
        <p style="font-size:20px;font-weight:bold">${params.amountLabel}</p>
        <p style="margin:24px 0">
          <a href="${params.url}" style="display:inline-block;background:#0d8f83;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Pay now</a>
        </p>
        <p style="color:#4a5a6a;font-size:13px">Secure payment powered by Stripe. Card, Apple Pay, and Google Pay are all accepted.</p>
        <p>Questions? Call or text us at ${business.phoneDisplay}.</p>
        <p style="margin-top:24px;color:#4a5a6a;font-size:14px">${business.name} · ${business.city}, ${business.region}</p>
      </div>
    `,
  };
}

export function paymentReceiptEmail(params: { firstName: string; amountLabel: string; description: string; receiptUrl?: string | null }) {
  return {
    subject: `Payment received — ${params.amountLabel} — ${business.name}`,
    html: `
      <div style="font-family:sans-serif;color:#0f2438;max-width:520px;margin:0 auto">
        <h2 style="color:#0b1f33">Thanks, ${escapeHtml(params.firstName)}!</h2>
        <p>We've received your payment for ${escapeHtml(params.description)}.</p>
        <p style="font-size:20px;font-weight:bold">${params.amountLabel}</p>
        ${params.receiptUrl ? `<p><a href="${params.receiptUrl}" style="color:#0d8f83">View your receipt</a></p>` : ""}
        <p>Questions? Call or text us at ${business.phoneDisplay}.</p>
        <p style="margin-top:24px;color:#4a5a6a;font-size:14px">${business.name} · ${business.city}, ${business.region}</p>
      </div>
    `,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
