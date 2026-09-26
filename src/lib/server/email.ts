import { Resend } from "resend";
import { business } from "@/lib/data/business";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { renderEmailTemplate, escapeHtml } from "@/lib/server/emailTemplates";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  mode: "live" | "mock" | "skipped";
  id?: string;
  error?: string;
}

/**
 * Sends transactional email. Two real provider options, checked in order — from /admin/settings
 * (checked first for each) or the matching env var (fallback):
 *   1. SMTP (a real mail server — your own domain, Google Workspace, Office 365, etc.), if a host
 *      is configured. Preferred when set, since it means an admin deliberately chose their own
 *      mail server over the default.
 *   2. Resend, if an API key is configured.
 * Falls back to a logged "mock send" so the full lead/quote flow can be exercised without either.
 * See .env.example.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const smtpHost = await getIntegrationValue("smtpHost", "SMTP_HOST");
  if (smtpHost) return sendViaSmtp(smtpHost, input);

  const resendApiKey = await getIntegrationValue("resendApiKey", "RESEND_API_KEY");
  if (resendApiKey) return sendViaResend(resendApiKey, input);

  console.info(`[mock email] to=${input.to} subject="${input.subject}"`);
  return { ok: true, mode: "mock" };
}

async function fromAddress(): Promise<string> {
  return (await getIntegrationValue("emailFrom", "EMAIL_FROM")) || "Abbie's Clean Method <onboarding@resend.dev>";
}

async function sendViaResend(resendApiKey: string, input: SendEmailInput): Promise<SendEmailResult> {
  const resend = new Resend(resendApiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: await fromAddress(),
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

async function sendViaSmtp(host: string, input: SendEmailInput): Promise<SendEmailResult> {
  const [port, username, password, secureRaw] = await Promise.all([
    getIntegrationValue("smtpPort", "SMTP_PORT"),
    getIntegrationValue("smtpUsername", "SMTP_USERNAME"),
    getIntegrationValue("smtpPassword", "SMTP_PASSWORD"),
    getIntegrationValue("smtpSecure", "SMTP_SECURE"),
  ]);
  const portNum = Number(port) || 587;
  try {
    // Dynamic import, not a static top-level one -- nodemailer's internal conditional requires
    // (net/tls/dns, plus its various transport backends) tripped Turbopack's production bundler
    // even with serverExternalPackages set (a real build failure hit while adding this: "the
    // chunking context does not support external modules (node:net)"). Deferring the require to
    // here, only reached once SMTP is actually configured, avoids Turbopack tracing it at all.
    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure: secureRaw ? secureRaw === "true" : portNum === 465,
      auth: username && password ? { user: username, pass: password } : undefined,
    });
    const info = await transporter.sendMail({
      from: await fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
    });
    return { ok: true, mode: "live", id: info.messageId };
  } catch (err) {
    return { ok: false, mode: "live", error: err instanceof Error ? err.message : "Unknown SMTP error" };
  }
}

const bizVars = { businessName: business.name, businessCity: business.city, businessRegion: business.region, businessPhone: business.phoneDisplay };

export async function customerConfirmationEmail(params: {
  firstName: string;
  reference: string;
  serviceName: string;
  estimateLabel: string;
}) {
  return renderEmailTemplate("CUSTOMER_QUOTE_CONFIRMATION", {
    firstName: escapeHtml(params.firstName),
    reference: escapeHtml(params.reference),
    serviceName: escapeHtml(params.serviceName),
    estimateLabel: escapeHtml(params.estimateLabel),
    ...bizVars,
  });
}

export async function businessNotificationEmail(params: {
  reference: string;
  name: string;
  phone: string;
  email: string;
  serviceName: string;
  estimateLabel: string;
  preferredContactMethod: string;
  zip: string;
}) {
  const leadDetailsListHtml = [
    ["Reference", params.reference],
    ["Name", params.name],
    ["Phone", params.phone],
    ["Email", params.email],
    ["ZIP", params.zip],
    ["Service", params.serviceName],
    ["Preliminary estimate", params.estimateLabel],
    ["Preferred contact", params.preferredContactMethod],
  ]
    .map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHtml(value)}</li>`)
    .join("");
  return renderEmailTemplate("BUSINESS_NEW_LEAD_NOTIFICATION", {
    reference: escapeHtml(params.reference),
    name: escapeHtml(params.name),
    serviceName: escapeHtml(params.serviceName),
    leadDetailsListHtml,
  });
}

export async function welcomeEmail(params: { firstName: string }) {
  return renderEmailTemplate("WELCOME", { firstName: escapeHtml(params.firstName), ...bizVars });
}

export async function adminInviteEmail(params: { name: string; loginUrl: string }) {
  return renderEmailTemplate("ADMIN_INVITE", { name: escapeHtml(params.name), loginUrl: params.loginUrl, businessName: business.name });
}

export async function adminPasswordResetEmail(params: { resetUrl: string }) {
  return renderEmailTemplate("ADMIN_PASSWORD_RESET", { resetUrl: params.resetUrl });
}

export async function quoteEmail(params: {
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
  const itemRows = params.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.label)} ${i.quantity > 1 ? `× ${i.quantity}` : ""}</td><td style="padding:6px 0;text-align:right">${money(i.total)}</td></tr>`
    )
    .join("");
  const discountRow = params.discount ? `<tr><td style="padding:6px 0">Discount</td><td style="padding:6px 0;text-align:right">-${money(params.discount)}</td></tr>` : "";
  const taxRow = params.tax ? `<tr><td style="padding:6px 0">Tax</td><td style="padding:6px 0;text-align:right">${money(params.tax)}</td></tr>` : "";
  const totalRow = `<tr style="border-top:1px solid #e2e8f0;font-weight:bold"><td style="padding:8px 0">Total</td><td style="padding:8px 0;text-align:right">${money(params.total)}</td></tr>`;
  const depositRow = params.deposit ? `<tr><td style="padding:6px 0">Deposit due to confirm</td><td style="padding:6px 0;text-align:right">${money(params.deposit)}</td></tr>` : "";
  return renderEmailTemplate("QUOTE_SENT", {
    firstName: escapeHtml(params.firstName),
    messageBlockHtml: params.message ? `<p>${escapeHtml(params.message)}</p>` : "",
    quoteNumber: escapeHtml(params.quoteNumber),
    itemsRowsHtml: itemRows + discountRow + taxRow + totalRow + depositRow,
    expiresBlockHtml: params.expiresAt ? `<p style="color:#4a5a6a;font-size:13px">This quote is valid until ${new Date(params.expiresAt).toLocaleDateString()}.</p>` : "",
    ...bizVars,
  });
}

export async function paymentLinkEmail(params: { firstName: string; amountLabel: string; description: string; url: string }) {
  return renderEmailTemplate("PAYMENT_LINK", {
    firstName: escapeHtml(params.firstName),
    description: escapeHtml(params.description),
    amountLabel: params.amountLabel,
    url: params.url,
    ...bizVars,
  });
}

export async function bookingRequestReceivedEmail(params: {
  firstName: string;
  reference: string;
  serviceName: string;
  scheduledStartLabel: string;
}) {
  return renderEmailTemplate("BOOKING_REQUEST_RECEIVED", {
    firstName: escapeHtml(params.firstName),
    reference: escapeHtml(params.reference),
    serviceName: escapeHtml(params.serviceName),
    scheduledStartLabel: escapeHtml(params.scheduledStartLabel),
    ...bizVars,
  });
}

export async function paymentReceiptEmail(params: { firstName: string; amountLabel: string; description: string; receiptUrl?: string | null; methodLabel?: string }) {
  return renderEmailTemplate("PAYMENT_RECEIPT", {
    firstName: escapeHtml(params.firstName),
    description: escapeHtml(params.description),
    amountLabel: params.amountLabel,
    methodBlockHtml: params.methodLabel ? `<p style="color:#4a5a6a;font-size:14px">Paid via ${escapeHtml(params.methodLabel)}</p>` : "",
    receiptBlockHtml: params.receiptUrl ? `<p><a href="${params.receiptUrl}" style="color:#0d8f83">View your receipt</a></p>` : "",
    ...bizVars,
  });
}
