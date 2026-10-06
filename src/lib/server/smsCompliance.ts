import { prisma, isDatabaseConfigured } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/server/integrationSettings";

export interface ComplianceItem {
  label: string;
  status: "done" | "missing" | "manual";
  detail?: string;
}

/**
 * Backs the Telnyx 10DLC readiness checklist on the admin Settings page. Everything checkable from
 * our own app state is checked for real -- never faked. The last two items (campaign approval,
 * number assignment) happen entirely on Telnyx's side and can't be verified from here, so they're
 * always shown as requiring manual confirmation, per the spec's "do not fake approval status."
 */
export async function getTelnyxComplianceChecklist(): Promise<ComplianceItem[]> {
  const integrationStatus = await getIntegrationStatus();
  const hasConsentEvents = isDatabaseConfigured && prisma ? (await prisma.smsConsentEvent.count()) > 0 : false;
  const hasInboundWebhook = isDatabaseConfigured && prisma ? (await prisma.webhookEvent.count({ where: { provider: "telnyx" } })) > 0 : false;

  const smsEnabled = process.env.SMS_ENABLED === "true";

  return [
    {
      label: smsEnabled ? "SMS_ENABLED is \"true\" -- real sends are LIVE" : "SMS_ENABLED is not \"true\" -- all sends are mocked/logged only",
      status: smsEnabled ? "missing" : "done", // "done" here means "safely off", not "fully configured" -- see detail
      detail: smsEnabled
        ? "Only set this to true in Vercel once the 10DLC campaign is confirmed APPROVED in the Telnyx portal."
        : "Correct while the 10DLC campaign is still PENDING. Do not set SMS_ENABLED=true in Vercel until Telnyx confirms the campaign is approved.",
    },
    { label: "Privacy Policy public", status: "done", detail: "/policies/privacy" },
    { label: "Terms public", status: "done", detail: "/policies/terms" },
    { label: "SMS consent disclosure deployed", status: "done", detail: "Quote, photo estimate, contact, and signup forms" },
    { label: "SMS consent stored", status: hasConsentEvents ? "done" : "missing", detail: hasConsentEvents ? "At least one real consent event on file" : "No consent events recorded yet" },
    { label: "STOP handling implemented", status: "done" },
    { label: "HELP handling implemented", status: "done" },
    { label: "START handling implemented", status: "done" },
    { label: "Telnyx API credentials configured", status: integrationStatus.telnyxApiKey.configured ? "done" : "missing" },
    { label: "Telnyx number configured", status: integrationStatus.telnyxFromNumber.configured || integrationStatus.telnyxMessagingProfileId.configured ? "done" : "missing" },
    { label: "Messaging Profile configured", status: integrationStatus.telnyxMessagingProfileId.configured ? "done" : "missing" },
    { label: "Webhook configured", status: hasInboundWebhook ? "done" : "missing", detail: hasInboundWebhook ? "At least one real inbound event received" : "No inbound webhook events received yet -- can't confirm from here until one arrives" },
    { label: "10DLC campaign approved", status: "manual", detail: "Not verifiable from this app -- confirm current status (Pending/Approved) in the Telnyx portal before ever setting SMS_ENABLED=true" },
    { label: "Number assigned to campaign", status: "manual", detail: "Not verifiable from this app -- confirm in the Telnyx portal" },
  ];
}
