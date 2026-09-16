import crypto from "crypto";

/**
 * Minimal signed-cookie session for the admin area, sufficient to gate
 * access during development/demo. Before production launch, replace the
 * env-based demo credential check in /api/admin/login with real lookups
 * against the `admin_users` table (hashed passwords, role checks, and
 * ideally a proper auth library / provider) — see CLIENT_CONFIRMATION_CHECKLIST.md.
 */
export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set. See .env.example.");
  }
  return secret;
}

export function createSessionToken(email: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${email}.${expires}`;
  const signature = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifySessionToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [email, expiresStr, signature] = decoded.split(".");
    if (!email || !expiresStr || !signature) return null;

    const expected = crypto.createHmac("sha256", getSecret()).update(`${email}.${expiresStr}`).digest("hex");
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    if (Date.now() > Number(expiresStr)) return null;
    return { email };
  } catch {
    return null;
  }
}
