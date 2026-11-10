import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createTestPaymentLink } from "@/lib/server/testPaymentStore";

const schema = z.object({
  amount: z.coerce.number().int().min(100).max(10000), // cents, $1-$100
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "FINANCE_MANAGE");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter an amount between $1 and $100." }, { status: 400 });

  const result = await createTestPaymentLink(parsed.data.amount);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
