import { NextRequest, NextResponse } from "next/server";
import { claimAccountSchema } from "@/lib/validation/account";
import { claimAccountFromLead, getProfile, AccountsUnavailableError } from "@/lib/server/accounts";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { sendEmail, welcomeEmail } from "@/lib/server/email";

/**
 * Turns a just-submitted guest quote request into a real account — offered
 * on the estimate wizard's success screen so customers aren't asked to
 * re-type their name/email/phone a second time.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`account-claim:${ip}`, 8, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = claimAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await claimAccountFromLead(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    const profile = await getProfile(result.userId);
    const { subject, html } = welcomeEmail({ firstName: profile?.customer?.firstName || "there" });
    await sendEmail({ to: parsed.data.email, subject, html });

    const token = createCustomerSessionToken(result.userId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    if (err instanceof AccountsUnavailableError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    throw err;
  }
}
