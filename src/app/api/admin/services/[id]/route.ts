import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateServiceContent } from "@/lib/server/servicesContent";
import { isServiceId } from "@/lib/data/services";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  shortDescription: z.string().trim().min(1).max(400).optional(),
  category: z.enum(["home", "specialty", "commercial"]).optional(),
  image: z.string().trim().max(500).optional(),
  imageAlt: z.string().trim().max(300).optional(),
  forWho: z.string().trim().max(400).optional(),
  included: z.array(z.string().trim().max(200)).max(30).optional(),
  addOns: z.array(z.string().trim().max(120)).max(30).optional(),
  recommendedFrequency: z.string().trim().max(300).optional(),
  prepare: z.array(z.string().trim().max(200)).max(30).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isServiceId(id)) return NextResponse.json({ ok: false, error: "Unknown service" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await updateServiceContent(id, parsed.data);
  return NextResponse.json({ ok: true });
}
