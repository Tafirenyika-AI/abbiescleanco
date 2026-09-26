import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { saveEmailTemplate, EMAIL_TEMPLATE_DEFS } from "@/lib/server/emailTemplates";

const schema = z.object({
  subject: z.string().trim().min(1).max(500),
  html: z.string().trim().min(1).max(20000),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_USERS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { key } = await params;

  const def = EMAIL_TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) return NextResponse.json({ ok: false, error: "Unknown template" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Subject and body can't be empty" }, { status: 400 });

  const combined = `${parsed.data.subject} ${parsed.data.html}`;
  const missing = def.variables.filter((v) => !combined.includes(`{{${v}}}`));
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: `Missing required placeholder(s): ${missing.map((v) => `{{${v}}}`).join(", ")}` }, { status: 400 });
  }

  const result = await saveEmailTemplate(key, parsed.data.subject, parsed.data.html, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
