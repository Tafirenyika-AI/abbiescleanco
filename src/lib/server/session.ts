import crypto from "crypto";

/**
 * Generic signed-cookie session, shared by admin sessions (adminAuth.ts) and
 * customer accounts (customerAuth.ts).
 *
 * The token is `${base64urlPayload}.${hmacSignatureHex}`. Using base64url
 * for the payload (not a raw delimited string) means the payload can never
 * itself contain the "." separator, so parsing can't be ambiguous — this
 * replaces an earlier scheme that split raw fields on "." and silently
 * mis-parsed any email address containing a dot (e.g. "name@domain.com").
 */
export interface SessionPayload {
  sub: string; // subject id
  scope: "admin" | "customer";
  exp: number; // epoch ms
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET (or legacy ADMIN_SESSION_SECRET) is not set. See .env.example.");
  }
  return secret;
}

export function createSessionToken(sub: string, scope: SessionPayload["scope"], ttlMs: number): string {
  const payload: SessionPayload = { sub, scope, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined, expectedScope: SessionPayload["scope"]): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("hex");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (payload.scope !== expectedScope) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
