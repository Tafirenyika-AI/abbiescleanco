export { sendCustomerSms, type SendCustomerSmsInput, type SendCustomerSmsResult } from "./send";
export { normalizePhone } from "./phone";
export { SMS_TEMPLATES } from "./templates";
export {
  recordSmsConsentEvent,
  hasSmsConsent,
  findCustomerByPhone,
  SMS_DISCLOSURE_VERSION,
  type SmsPurpose,
  type SmsConsentMethod,
  type SmsConsentSource,
} from "./consent";
export { getSmsProvider } from "./provider";
export type { SMSProvider } from "./types";
