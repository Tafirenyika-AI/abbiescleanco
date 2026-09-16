import { NextRequest, NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/account";
import { requestPasswordReset, AccountsUnavailableError } from "@/lib/server/accounts";
import { sendEmail } from "@/lib/server/email";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
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

  try {
    const token = await requestPasswordReset(parsed.data.email);
    // Always respond success — never reveal whether an account exists for this email.
    if (token) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const resetUrl = `${siteUrl}/account/reset-password?token=${token}`;
      await sendEmail({
        to: parsed.data.email,
        subject: "Reset your password",
        html: `
          <div style="font-family:sans-serif;color:#0f2438;max-width:480px;margin:0 auto">
            <h2>Reset your password</h2>
            <p>Click the link below to choose a new password. This link expires in 1 hour.</p>
            <p><a href="${resetUrl}" style="color:#0d8f83">${resetUrl}</a></p>
            <p style="color:#4a5a6a;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AccountsUnavailableError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    throw err;
  }
}
