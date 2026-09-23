import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { changePasswordSchema } from "@/lib/validation/account";
import { changePassword } from "@/lib/server/accounts";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`change-password:${session.userId}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const success = await changePassword(session.userId, parsed.data.currentPassword, parsed.data.newPassword);
  if (!success) {
    return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
