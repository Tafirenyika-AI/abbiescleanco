import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateCampaign, deleteCampaign, MARKETING_CHANNELS, CAMPAIGN_STATUSES } from "@/lib/server/marketingStore";

const schema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  channel: z.enum(MARKETING_CHANNELS).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  utmCampaign: z.string().trim().min(1).max(200).nullable().optional(),
  spend: z.number().int().min(0).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  const data = parsed.data;

  const result = await updateCampaign(
    id,
    {
      ...data,
      startDate: data.startDate === undefined ? undefined : data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate) : null,
    },
    admin.id
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deleteCampaign(id, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
