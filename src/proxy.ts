import { NextResponse, type NextRequest } from "next/server";

/**
 * Defense-in-depth backstop for the /admin and /api/account surfaces. Every route in both already
 * checks auth itself today -- admin API routes via requireAdmin(), the admin dashboard pages via
 * the (dashboard) layout's own session lookup+redirect, and /api/account/* routes via
 * requireCustomer() (src/lib/server/customerContext.ts) -- so this proxy is deliberately NOT the
 * primary authorization mechanism. It exists so a route added later that forgets that call fails
 * closed (401 for APIs, redirect-to-login for admin pages) instead of silently being reachable by
 * anyone with no session at all. It only checks "is this a validly signed, unexpired session token
 * of the right scope" -- not fine-grained admin permissions (stay in requireAdmin(req, permission))
 * and not the DB-backed "does this session's user actually have a linked Customer row" check (stays
 * in requireCustomer()), both of which this proxy deliberately skips to stay fast and dependency-
 * free. The public marketing site and the single customer-facing /account page are NOT covered:
 * /account already does its own session check server-side (one page, not the ~29 the admin surface
 * has, so a proxy-level backstop adds little there), and /api/account's pre-auth endpoints
 * (signup/login/etc.) must stay reachable by definition.
 *
 * Verification is reimplemented here with Web Crypto rather than importing session.ts (which uses
 * Node's `crypto` module) because the proxy runs in the Edge runtime by default, which can't load
 * Node built-ins. If session.ts's token format ever changes, this must be updated to match --
 * that coupling is the tradeoff for not needing a Node-runtime proxy configuration.
 */

const ADMIN_SESSION_COOKIE = "admin_session";
const CUSTOMER_SESSION_COOKIE = "customer_session";

const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/api/admin/login",
  "/api/admin/login/verify-2fa",
  "/api/admin/forgot-password",
  "/api/admin/reset-password",
  "/api/admin/logout",
]);

const PUBLIC_ACCOUNT_API_PATHS = new Set([
  "/api/account/login",
  "/api/account/signup",
  "/api/account/forgot-password",
  "/api/account/reset-password",
  "/api/account/claim",
  "/api/account/logout",
]);

function base64urlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Mirrors session.ts's verifySessionToken -- both admin and customer sessions share the same signing scheme, only `scope` differs. */
async function hasValidSession(token: string | undefined, expectedScope: "admin" | "customer"): Promise<boolean> {
  if (!token) return false;
  const [body, signatureHex] = token.split(".");
  if (!body || !signatureHex) return false;

  const secret = process.env.SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const validSignature = await crypto.subtle.verify("HMAC", key, hexToBytes(signatureHex) as BufferSource, new TextEncoder().encode(body));
    if (!validSignature) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(body))) as { scope?: string; exp?: number };
    return payload.scope === expectedScope && typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/account/")) {
    if (PUBLIC_ACCOUNT_API_PATHS.has(pathname)) return NextResponse.next();
    const authed = await hasValidSession(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value, "customer");
    if (authed) return NextResponse.next();
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const authed = await hasValidSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, "admin");
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/account/:path*"],
};
