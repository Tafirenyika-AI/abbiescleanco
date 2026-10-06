export interface RawSendParams {
  to: string; // E.164
  body: string;
}

export interface RawSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Every real SMS provider (Telnyx, Twilio, ...) implements this. Nothing outside
 * src/lib/server/sms/ should ever import a provider directly or call a provider's own SDK/REST
 * API -- always go through sendCustomerSms() in send.ts, which is the one place consent,
 * suppression, and the SMS_ENABLED safety gate are enforced.
 */
export interface SMSProvider {
  readonly name: string;
  send(params: RawSendParams): Promise<RawSendResult>;
}
