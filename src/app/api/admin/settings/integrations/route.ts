import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getIntegrationStatus, saveIntegrationSettings, clearIntegrationField } from "@/lib/server/integrationSettings";

// Gated behind MANAGE_USERS (the highest-trust permission already in the
// system) rather than MANAGE_CONTENT — these are API secrets, not website copy.
const schema = z.object({
  resendApiKey: z.string().trim().max(300).optional(),
  emailFrom: z.string().trim().max(300).optional(),
  twilioAccountSid: z.string().trim().max(300).optional(),
  twilioAuthToken: z.string().trim().max(300).optional(),
  twilioFromNumber: z.string().trim().max(60).optional(),
  stripeSecretKey: z.string().trim().max(300).optional(),
  googleMapsApiKey: z.string().trim().max(300).optional(),
  turnstileSecretKey: z.string().trim().max(300).optional(),
  turnstileSiteKey: z.string().trim().max(300).optional(),
  sentryDsn: z.string().trim().max(300).optional(),
  anthropicApiKey: z.string().trim().max(300).optional(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, status: await getIntegrationStatus() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await saveIntegrationSettings(parsed.data);
  return NextResponse.json({ ok: true });
}

const clearSchema = z.object({ field: z.string() });

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = clearSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid field" }, { status: 400 });

  await clearIntegrationField(parsed.data.field as Parameters<typeof clearIntegrationField>[0]);
  return NextResponse.json({ ok: true });
}
