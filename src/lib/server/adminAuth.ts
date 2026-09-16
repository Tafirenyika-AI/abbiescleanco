import { createSessionToken, verifySessionToken as verifyGeneric } from "./session";

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function createAdminSessionToken(adminUserId: string): string {
  return createSessionToken(adminUserId, "admin", SESSION_TTL_MS);
}

export function verifyAdminSessionToken(token: string | undefined): { adminUserId: string } | null {
  const payload = verifyGeneric(token, "admin");
  return payload ? { adminUserId: payload.sub } : null;
}
