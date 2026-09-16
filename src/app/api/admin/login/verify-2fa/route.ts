import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSessionToken, verifyAdmin2faPendingToken, ADMIN_SESSION_COOKIE, ADMIN_2FA_PENDING_COOKIE } from "@/lib/server/adminAuth";
import { verifyTwoFactorLogin } from "@/lib/server/adminUsers";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({ code: z.string().trim().min(6).max(20) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`admin-2fa:${ip}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const pending = verifyAdmin2faPendingToken(req.cookies.get(ADMIN_2FA_PENDING_COOKIE)?.value);
  if (!pending) {
    return NextResponse.json({ ok: false, error: "Session expired — sign in again." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter your 6-digit code" }, { status: 400 });
  }

  const valid = await verifyTwoFactorLogin(pending.adminUserId, parsed.data.code);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Incorrect code. Please try again." }, { status: 401 });
  }

  const token = createAdminSessionToken(pending.adminUserId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  res.cookies.delete(ADMIN_2FA_PENDING_COOKIE);
  return res;
}
