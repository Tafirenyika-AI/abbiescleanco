import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listCampaigns, createCampaign, MARKETING_CHANNELS } from "@/lib/server/marketingStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const campaigns = await listCampaigns();
  return NextResponse.json({ ok: true, campaigns });
}

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  channel: z.enum(MARKETING_CHANNELS),
  utmCampaign: z.string().trim().min(1).max(200).nullable(),
  spend: z.number().int().min(0),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  const data = parsed.data;

  const result = await createCampaign({
    name: data.name,
    channel: data.channel,
    utmCampaign: data.utmCampaign,
    spend: data.spend,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    notes: data.notes,
    createdById: admin.id,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
