import { getIntegrationValue } from "@/lib/server/integrationSettings";
import type { SMSProvider, RawSendParams, RawSendResult } from "./types";

/** Preserves the exact behavior this project already had before the Telnyx migration -- kept as a
 *  fallback provider (see provider.ts) so switching SMS_PROVIDER back to "twilio" needs no code
 *  change, just a config flip. */
export class TwilioSMSProvider implements SMSProvider {
  readonly name = "twilio";

  async send(params: RawSendParams): Promise<RawSendResult> {
    const [accountSid, authToken, fromNumber, messagingServiceSid] = await Promise.all([
      getIntegrationValue("twilioAccountSid", "TWILIO_ACCOUNT_SID"),
      getIntegrationValue("twilioAuthToken", "TWILIO_AUTH_TOKEN"),
      getIntegrationValue("twilioFromNumber", "TWILIO_FROM_NUMBER"),
      getIntegrationValue("twilioMessagingServiceSid", "TWILIO_MESSAGING_SERVICE_SID"),
    ]);
    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      return { ok: false, error: "Twilio not configured" };
    }

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const body: Record<string, string> = messagingServiceSid
        ? { To: params.to, MessagingServiceSid: messagingServiceSid, Body: params.body }
        : { To: params.to, From: fromNumber!, Body: params.body };
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.message || `Twilio error ${res.status}` };
      return { ok: true, providerMessageId: json?.sid };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown Twilio error" };
    }
  }
}
