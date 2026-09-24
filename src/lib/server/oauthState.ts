import crypto from "crypto";

/**
 * Signed, short-lived CSRF state for outbound OAuth "Connect X" flows (Meta/Google
 * Ads/TikTok). Deliberately separate from session.ts's createSessionToken/verifySessionToken
 * -- those are for real login sessions with a closed scope union; this is a narrower,
 * single-purpose token that also carries which admin started the flow, so the callback can
 * record who connected the account even though it can't rely on request context beyond the
 * query string.
 */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET (or legacy ADMIN_SESSION_SECRET) is not set. See .env.example.");
  return secret;
}

export function createOAuthState(adminUserId: string, ttlMs = 10 * 60 * 1000): string {
  const payload = { adminUserId, exp: Date.now() + ttlMs, nonce: crypto.randomBytes(8).toString("hex") };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
  return `${body}.${signature}`;
}

export function verifyOAuthState(state: string | null): { adminUserId: string } | null {
  if (!state) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  try {
    const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as { adminUserId: string; exp: number };
    if (Date.now() > payload.exp) return null;
    return { adminUserId: payload.adminUserId };
  } catch {
    return null;
  }
}
