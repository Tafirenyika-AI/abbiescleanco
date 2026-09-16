import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { checkRateLimit } from "@/lib/server/rateLimit";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const demoEmail = process.env.ADMIN_DEMO_EMAIL;
  const demoPassword = process.env.ADMIN_DEMO_PASSWORD;
  if (!demoEmail || !demoPassword) {
    return NextResponse.json(
      { ok: false, error: "Admin login is not configured. Set ADMIN_DEMO_EMAIL / ADMIN_DEMO_PASSWORD (see .env.example)." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email and password" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  if (email.toLowerCase() !== demoEmail.toLowerCase() || password !== demoPassword) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken(email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
