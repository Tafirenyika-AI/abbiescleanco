import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getEmailSignatureSettings, setEmailSignatureSettings } from "@/lib/server/siteSettings";

const schema = z.object({
  founderFirstName: z.string().trim().min(1).max(60),
  founderLastName: z.string().trim().min(1).max(60),
  founderTitle: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(1).max(160),
  imageUrl: z.string().trim().max(2048).nullable(),
});

// Gated on MANAGE_LEADS, not MANAGE_CONTENT -- this signature is only ever used on prospecting
// outreach emails (see buildEmailSignatureHtml in prospectStore.ts), so it belongs with whoever
// manages prospecting, not general site content/branding.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, signature: await getEmailSignatureSettings() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await setEmailSignatureSettings(parsed.data);
  return NextResponse.json({ ok: true });
}
