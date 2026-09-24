import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { confirmMatch } from "@/lib/server/bankStore";

const schema = z.object({
  matchType: z.enum(["PAYMENT", "EXPENSE"]),
  matchedId: z.string().trim().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await confirmMatch(id, parsed.data.matchType, parsed.data.matchedId, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
