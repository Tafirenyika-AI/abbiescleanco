import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@/lib/db";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";
import { checkRateLimit } from "@/lib/server/rateLimit";

export interface CustomerContext {
  userId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Same-origin check for cookie-authenticated mutations -- defense in depth on top of SameSite=Lax. */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, server-to-server) don't send Origin; cookies still required
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Resolves the signed-in customer from the verified session cookie. The customerId comes from
 * the database row linked to the session's user -- never from anything the client sends -- and
 * every store function below takes it as a mandatory scope, so one customer can't reach another's data.
 */
export async function requireCustomer(req: NextRequest, opts: { mutating?: boolean } = {}): Promise<{ ctx: CustomerContext } | { error: NextResponse }> {
  if (opts.mutating && !isSameOrigin(req)) {
    return { error: NextResponse.json({ ok: false, error: "Cross-site request blocked" }, { status: 403 }) };
  }
  const session = verifyCustomerSessionToken(req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value);
  if (!session) return { error: NextResponse.json({ ok: false, error: "Please sign in" }, { status: 401 }) };
  if (!isDatabaseConfigured || !prisma) return { error: NextResponse.json({ ok: false, error: "Unavailable" }, { status: 503 }) };

  const customer = await prisma.customer.findFirst({ where: { userId: session.userId, deletedAt: null } });
  if (!customer) return { error: NextResponse.json({ ok: false, error: "No customer profile for this account" }, { status: 403 }) };

  if (opts.mutating) {
    const rl = await checkRateLimit(`customer-mutation:${customer.id}`, 60, 60_000);
    if (!rl.allowed) return { error: NextResponse.json({ ok: false, error: "Too many requests, slow down a moment" }, { status: 429 }) };
  }
  return { ctx: { userId: session.userId, customerId: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email } };
}
