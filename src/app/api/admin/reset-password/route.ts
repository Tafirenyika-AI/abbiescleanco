import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validation/account";
import { resetAdminPassword } from "@/lib/server/adminUsers";
import { checkRateLimit } from "@/lib/server/rateLimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(`admin-reset-password:${ip}`, 10, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const success = await resetAdminPassword(parsed.data.token, parsed.data.password);
  if (!success) {
    return NextResponse.json({ ok: false, error: "This reset link is invalid or has expired." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
