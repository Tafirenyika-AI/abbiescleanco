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

/**
 * Issued after a correct email/password when 2FA is enabled, in place of a
 * real session — proves "password was correct" without granting access
 * until the TOTP/backup-code step also passes. Deliberately short-lived and
 * on a distinct scope so it can never be mistaken for (or misused as) a
 * real admin session.
 */
export const ADMIN_2FA_PENDING_COOKIE = "admin_2fa_pending";
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function createAdmin2faPendingToken(adminUserId: string): string {
  return createSessionToken(adminUserId, "admin_2fa_pending", PENDING_TTL_MS);
}

export function verifyAdmin2faPendingToken(token: string | undefined): { adminUserId: string } | null {
  const payload = verifyGeneric(token, "admin_2fa_pending");
  return payload ? { adminUserId: payload.sub } : null;
}
