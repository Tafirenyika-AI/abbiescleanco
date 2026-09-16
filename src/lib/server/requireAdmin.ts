import type { NextRequest } from "next/server";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "./adminAuth";
import { getAdminProfile, hasPermission, type AdminPermission, type AdminProfile } from "./adminUsers";

/**
 * Reads the session cookie straight off the request instead of importing
 * `cookies()` from next/headers — that API depends on Next's request-scoped
 * context, which only exists when Next itself invokes the handler. Reading
 * from `req.cookies` works identically in real traffic and lets route
 * handlers be called directly in integration tests.
 */
export async function requireAdmin(req: NextRequest, permission?: AdminPermission): Promise<AdminProfile | null> {
  const session = verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return null;

  const admin = await getAdminProfile(session.adminUserId);
  if (!admin) return null;
  if (permission && !hasPermission(admin, permission)) return null;

  return admin;
}
