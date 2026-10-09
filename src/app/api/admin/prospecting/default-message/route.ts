import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getDefaultOutreachTemplate, saveDefaultOutreachTemplate } from "@/lib/server/prospectStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const template = await getDefaultOutreachTemplate();
  return NextResponse.json({ ok: true, template });
}

const schema = z.object({
  subject: z.string().trim().max(200),
  body: z.string().trim().max(5000),
});

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await saveDefaultOutreachTemplate(parsed.data);
  return NextResponse.json({ ok: true });
}
