import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, ADMIN_SESSION_COOKIE } from "@/lib/server/adminAuth";
import { pricingConfigSchema } from "@/lib/validation/pricingConfig";
import { getPricingConfig, savePricingConfig } from "@/lib/server/pricingStore";

// Reads the session cookie straight off the request instead of importing
// `cookies()` from next/headers — that API depends on Next's request-scoped
// context, which only exists when Next itself invokes the handler. Reading
// from `req.cookies` works identically in real traffic and lets these
// handlers be called directly in integration tests.
function requireAdmin(req: NextRequest) {
  return verifySessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const config = await getPricingConfig();
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = pricingConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  await savePricingConfig(parsed.data);
  return NextResponse.json({ ok: true });
}
