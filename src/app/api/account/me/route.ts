import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { getProfile } from "@/lib/server/accounts";

export async function GET(req: NextRequest) {
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: true, user: null });

  const profile = await getProfile(session.userId);
  return NextResponse.json({ ok: true, user: profile });
}
