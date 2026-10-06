import { getIntegrationValue } from "@/lib/server/integrationSettings";
import type { SMSProvider, RawSendParams, RawSendResult } from "./types";

/**
 * Telnyx Programmable Messaging v2 API (https://api.telnyx.com/v2/messages). Prefers sending via a
 * Messaging Profile (telnyx's equivalent of Twilio's Messaging Service -- the right way to send
 * under an approved 10DLC campaign) when configured, falling back to a bare From number.
 */
export class TelnyxSMSProvider implements SMSProvider {
  readonly name = "telnyx";

  async send(params: RawSendParams): Promise<RawSendResult> {
    const [apiKey, messagingProfileId, fromNumber] = await Promise.all([
      getIntegrationValue("telnyxApiKey", "TELNYX_API_KEY"),
      getIntegrationValue("telnyxMessagingProfileId", "TELNYX_MESSAGING_PROFILE_ID"),
      getIntegrationValue("telnyxFromNumber", "TELNYX_FROM_NUMBER"),
    ]);
    if (!apiKey || (!messagingProfileId && !fromNumber)) {
      return { ok: false, error: "Telnyx not configured" };
    }

    try {
      const body: Record<string, string> = messagingProfileId
        ? { to: params.to, messaging_profile_id: messagingProfileId, text: params.body }
        : { to: params.to, from: fromNumber!, text: params.body };
      const res = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: json?.errors?.[0]?.detail || `Telnyx error ${res.status}` };
      return { ok: true, providerMessageId: json?.data?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown Telnyx error" };
    }
  }
}
