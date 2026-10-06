import type { SMSProvider, RawSendParams, RawSendResult } from "./types";

/** Logs instead of sending. Used whenever SMS_ENABLED isn't exactly "true", and whenever no real
 *  provider is configured -- keeps local dev, tests, and preview deployments from ever texting a
 *  real customer by default. */
export class MockSMSProvider implements SMSProvider {
  readonly name = "mock";

  async send(params: RawSendParams): Promise<RawSendResult> {
    console.info(`[mock sms] to=${params.to} body="${params.body}"`);
    return { ok: true, providerMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  }
}
