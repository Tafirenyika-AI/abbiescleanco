import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/account";
import { requestAdminPasswordReset } from "@/lib/server/adminUsers";
import { sendEmail, adminPasswordResetEmail } from "@/lib/server/email";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`admin-forgot-password:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }

  const token = await requestAdminPasswordReset(parsed.data.email);
  // Always respond success — never reveal whether an admin account exists for this email.
  if (token) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const resetUrl = `${siteUrl}/admin/reset-password?token=${token}`;
    const { subject, html } = adminPasswordResetEmail({ resetUrl });
    await sendEmail({ to: parsed.data.email, subject, html });
  }
  return NextResponse.json({ ok: true });
}
