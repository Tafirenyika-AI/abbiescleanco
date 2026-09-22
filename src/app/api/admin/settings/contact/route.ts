import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getContactInfo, setContactInfo } from "@/lib/server/siteSettings";

const schema = z.object({
  phoneDisplay: z.string().trim().min(7).max(30),
  phoneE164: z.string().trim().regex(/^\+\d{8,15}$/, "Use E.164 format, e.g. +16504007983"),
  whatsappE164: z.string().trim().regex(/^\d{8,15}$/, "Digits only, no + or spaces, e.g. 16504007983"),
  email: z.string().trim().email(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, contact: await getContactInfo() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await setContactInfo(parsed.data);
  // The public site's root layout fetches contact info once and passes it down -- revalidating
  // the layout (not just one page) refreshes it everywhere at once instead of waiting out each
  // page's own ISR window.
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
