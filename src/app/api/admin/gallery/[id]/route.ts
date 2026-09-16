import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateGalleryItem, deleteGalleryItem } from "@/lib/server/content";

const updateSchema = z.object({
  imageUrl: z.string().trim().min(1).max(500).optional(),
  altText: z.string().trim().min(1).max(300).optional(),
  caption: z.string().trim().max(300).optional(),
  serviceType: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await updateGalleryItem(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteGalleryItem(id);
  return NextResponse.json({ ok: true });
}
