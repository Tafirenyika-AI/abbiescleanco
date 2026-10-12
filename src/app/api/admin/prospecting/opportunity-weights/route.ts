import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getCommercialOpportunityWeights, saveCommercialOpportunityWeights } from "@/lib/server/prospectStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const weights = await getCommercialOpportunityWeights();
  return NextResponse.json({ ok: true, weights });
}

const schema = z.object({
  buyingSignal: z.number().min(0).max(100),
  recurringPotential: z.number().min(0).max(100),
  decisionMakerAccess: z.number().min(0).max(100),
  commercialSuitability: z.number().min(0).max(100),
  geographicFit: z.number().min(0).max(100),
});

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await saveCommercialOpportunityWeights(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
