import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listPosts, createPost, MARKETING_CHANNELS } from "@/lib/server/marketingStore";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const posts = await listPosts();
  return NextResponse.json({ ok: true, posts });
}

const schema = z.object({
  campaignId: z.string().trim().min(1).nullable(),
  channel: z.enum(MARKETING_CHANNELS),
  caption: z.string().trim().min(1).max(5000),
  scheduledFor: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });
  const data = parsed.data;

  const result = await createPost({
    campaignId: data.campaignId,
    channel: data.channel,
    caption: data.caption,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
    createdById: admin.id,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
