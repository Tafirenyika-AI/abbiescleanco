/**
 * SMS / WhatsApp Business notification adapter.
 *
 * Live sending requires Twilio (or an approved WhatsApp Business API
 * provider) credentials — see .env.example for TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER. Without them this logs the message
 * instead of sending it, so automation flows remain testable.
 */
export interface SendSmsResult {
  ok: boolean;
  mode: "live" | "mock";
  error?: string;
}

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  if (!accountSid || !authToken || !fromNumber) {
    console.info(`[mock sms] to=${to} body="${body}"`);
    return { ok: true, mode: "mock" };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, mode: "live", error: text };
    }
    return { ok: true, mode: "live" };
  } catch (err) {
    return { ok: false, mode: "live", error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}
