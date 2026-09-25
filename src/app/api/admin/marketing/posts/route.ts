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

// Accepts either a root-relative path (/api/files/[id], the normal database-backed storage
// URL) or a real absolute URL (a large customer video uploaded straight to Vercel Blob) --
// z.string().url() alone would reject the root-relative shape most upload endpoints return.
const mediaUrlSchema = z.string().trim().min(1).refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Must be a real uploaded file URL").nullable();

const schema = z.object({
  campaignId: z.string().trim().min(1).nullable(),
  channel: z.enum(MARKETING_CHANNELS),
  caption: z.string().trim().min(1).max(5000),
  mediaUrl: mediaUrlSchema,
  videoUrl: mediaUrlSchema,
  socialConnectionId: z.string().trim().min(1).nullable(),
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
    mediaUrl: data.mediaUrl,
    videoUrl: data.videoUrl,
    socialConnectionId: data.socialConnectionId,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
    createdById: admin.id,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
