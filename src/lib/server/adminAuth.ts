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

function sign(expires: number, email: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`${expires}.${email}`).digest("hex");
}

export function createSessionToken(email: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = sign(expires, email);
  // Field order matters: expires (digits only) and signature (hex only)
  // never contain ".", so they can lead safely. Email is last and rejoined
  // from every remaining segment, since real addresses routinely contain
  // "." themselves (e.g. "admin@abbiescleanco.com") — splitting on "." with
  // email first or in the middle silently mis-parses those.
  return Buffer.from(`${expires}.${signature}.${email}`).toString("base64url");
}

export function verifySessionToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [expiresStr, signature, ...emailParts] = decoded.split(".");
    const email = emailParts.join(".");
    if (!expiresStr || !signature || !email) return null;

    const expected = sign(Number(expiresStr), email);
    const valid =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;

    if (Date.now() > Number(expiresStr)) return null;
    return { email };
  } catch {
    return null;
  }
}
