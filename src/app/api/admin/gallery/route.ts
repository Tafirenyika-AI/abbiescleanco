import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { listGalleryItems, createGalleryItem } from "@/lib/server/content";

const createSchema = z.object({
  imageUrl: z.string().trim().min(1).max(500),
  altText: z.string().trim().min(1).max(300),
  caption: z.string().trim().max(300).optional().or(z.literal("")),
  serviceType: z.string().trim().max(120).optional().or(z.literal("")),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, items: await listGalleryItems() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const item = await createGalleryItem(parsed.data);
  return NextResponse.json({ ok: true, id: item.id });
}
