import { getIntegrationValue } from "@/lib/server/integrationSettings";
import { MockSMSProvider } from "./mockProvider";
import { TwilioSMSProvider } from "./twilioProvider";
import { TelnyxSMSProvider } from "./telnyxProvider";
import type { SMSProvider } from "./types";

/**
 * Single choke point deciding whether a real provider is even allowed to run. SMS_ENABLED must be
 * the literal string "true" -- anything else (unset, "false", a typo) falls back to the mock
 * provider. This is what keeps local dev, automated tests, and Vercel preview deployments from
 * ever texting a real customer: none of those environments should ever have SMS_ENABLED=true set.
 * Only the real production environment variables should.
 */
export async function getSmsProvider(): Promise<SMSProvider> {
  if (process.env.SMS_ENABLED !== "true") return new MockSMSProvider();

  const providerName = (await getIntegrationValue("smsProvider", "SMS_PROVIDER")) || "telnyx";
  if (providerName === "twilio") return new TwilioSMSProvider();
  if (providerName === "mock") return new MockSMSProvider();
  return new TelnyxSMSProvider();
}
