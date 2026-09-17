import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getAutomationRules, setAutomationRules, CONFIGURABLE_AUTOMATION_TYPES } from "@/lib/server/automationStore";

const ruleSchema = z.object({ enabled: z.boolean(), offsetHours: z.coerce.number().int().min(1).optional() });
const schema = z.object(
  Object.fromEntries(CONFIGURABLE_AUTOMATION_TYPES.map((t) => [t, ruleSchema])) as Record<(typeof CONFIGURABLE_AUTOMATION_TYPES)[number], typeof ruleSchema>
);

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rules = await getAutomationRules();
  return NextResponse.json({ ok: true, rules });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await setAutomationRules(parsed.data);
  return NextResponse.json({ ok: true });
}
