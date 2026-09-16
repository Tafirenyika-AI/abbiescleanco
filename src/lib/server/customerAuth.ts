import { createSessionToken, verifySessionToken as verifyGeneric } from "./session";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — customers expect to stay signed in

export function createCustomerSessionToken(userId: string): string {
  return createSessionToken(userId, "customer", SESSION_TTL_MS);
}

export function verifyCustomerSessionToken(token: string | undefined): { userId: string } | null {
  const payload = verifyGeneric(token, "customer");
  return payload ? { userId: payload.sub } : null;
}
