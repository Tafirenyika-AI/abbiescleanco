import { Resend } from "resend";
import { business } from "@/lib/data/business";

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "Abbie's Clean Method <onboarding@resend.dev>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
 * Sends transactional email via Resend when RESEND_API_KEY is configured.
 * Falls back to a logged "mock send" so the full lead/quote flow can be
 * exercised locally without a live email provider. See .env.example.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    console.info(`[mock email] to=${input.to} subject="${input.subject}"`);
    return { ok: true, mode: "mock" };
  }

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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
