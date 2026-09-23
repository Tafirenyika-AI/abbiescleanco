import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { executeAssistantAction, type AssistantAction } from "@/lib/server/assistant";
import { LEAD_STATUSES } from "@/lib/server/leadStore";

// Only one action kind exists today (a lead status change), gated behind the same permission the
// lead status API itself uses. If more action kinds are added later, this gate needs to become
// kind-dependent rather than a single fixed permission.
const schema = z.object({
  kind: z.literal("update_lead_status"),
  leadId: z.string().trim().min(1).max(50),
  reference: z.string().trim().max(30),
  toStatus: z.enum(LEAD_STATUSES),
  statusLabel: z.string().trim().max(60),
});

export async function POST(req: NextRequest) {
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

  const result = await executeAssistantAction(parsed.data as AssistantAction, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
