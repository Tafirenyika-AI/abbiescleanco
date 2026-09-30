import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deletePost, updatePost, MARKETING_CHANNELS } from "@/lib/server/marketingStore";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await deletePost(id, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

// Same shape as POST /api/admin/marketing/posts, minus scheduledFor (not surfaced in the edit UI).
const mediaUrlSchema = z.string().trim().min(1).refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Must be a real uploaded file URL").nullable();
const editSchema = z.object({
  campaignId: z.string().trim().min(1).nullable(),
  channel: z.enum(MARKETING_CHANNELS),
  caption: z.string().trim().min(1).max(5000),
  mediaUrl: mediaUrlSchema,
  videoUrl: mediaUrlSchema,
  socialConnectionId: z.string().trim().min(1).nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = editSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await updatePost(id, parsed.data, admin.id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
