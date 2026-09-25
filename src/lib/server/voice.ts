import { getIntegrationValue } from "@/lib/server/integrationSettings";

/**
 * Voice-call adapter, same shape and credential source as sms.ts -- Twilio Voice uses the same
 * account, just a different REST endpoint. Live sending requires the same Twilio credentials
 * already used for SMS; without them, this logs instead of placing a real call.
 */
export interface InitiateCallResult {
  ok: boolean;
  mode: "live" | "mock";
  error?: string;
  callSid?: string;
}

/** Calls `to`; once answered, Twilio fetches TwiML from `twimlUrl` to decide what happens next
 *  (here, always a <Dial> that bridges to the other party -- see /api/twiml/bridge/[id]). */
export async function initiateCall(to: string, twimlUrl: string): Promise<InitiateCallResult> {
  const [accountSid, authToken, fromNumber] = await Promise.all([
    getIntegrationValue("twilioAccountSid", "TWILIO_ACCOUNT_SID"),
    getIntegrationValue("twilioAuthToken", "TWILIO_AUTH_TOKEN"),
    getIntegrationValue("twilioFromNumber", "TWILIO_FROM_NUMBER"),
  ]);

  if (!accountSid || !authToken || !fromNumber) {
    console.info(`[mock call] to=${to} twimlUrl=${twimlUrl}`);
    return { ok: true, mode: "mock" };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: fromNumber, Url: twimlUrl }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, mode: "live", error: text };
    }
    const data = (await res.json()) as { sid?: string };
    return { ok: true, mode: "live", callSid: data.sid };
  } catch (err) {
    return { ok: false, mode: "live", error: err instanceof Error ? err.message : "Unknown call error" };
  }
}
