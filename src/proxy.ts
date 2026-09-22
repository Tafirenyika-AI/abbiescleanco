import { NextResponse, type NextRequest } from "next/server";

/**
 * Defense-in-depth backstop for the whole /admin surface. Every admin route already checks auth
 * itself today -- API routes via requireAdmin() (src/lib/server/requireAdmin.ts), dashboard pages
 * via the (dashboard) layout's own session lookup+redirect -- so this middleware is deliberately
 * NOT the primary authorization mechanism. It exists so a route added later that forgets that
 * call fails closed (401 for APIs, redirect-to-login for pages) instead of silently being
 * reachable by anyone with no session at all. It only checks "is this a validly signed, unexpired
 * ADMIN-scoped session token" -- not fine-grained permissions, which stay in each route's own
 * requireAdmin(req, permission) call (that also does a DB lookup this middleware deliberately
 * avoids, to stay fast and dependency-free).
 *
 * Verification is reimplemented here with Web Crypto rather than importing session.ts (which uses
 * Node's `crypto` module) because middleware runs in the Edge runtime by default, which can't load
 * Node built-ins. If session.ts's token format ever changes, this must be updated to match --
 * that coupling is the tradeoff for not needing a Node-runtime middleware configuration.
 */

const ADMIN_SESSION_COOKIE = "admin_session";

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

async function hasValidAdminSession(token: string | undefined): Promise<boolean> {
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
    return payload.scope === "admin" && typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const authed = await hasValidAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
