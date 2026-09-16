import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { updateProfileSchema } from "@/lib/validation/account";
import { getProfile, updateProfile } from "@/lib/server/accounts";

export async function GET(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(session.userId);
  return NextResponse.json({ ok: true, user: profile });
}

export async function PATCH(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  await updateProfile(session.userId, parsed.data);
  return NextResponse.json({ ok: true });
}
