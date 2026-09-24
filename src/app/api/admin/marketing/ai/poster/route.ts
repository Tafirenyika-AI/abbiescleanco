import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { generatePosterImage, IMAGE_SIZES } from "@/lib/server/aiContent";

const schema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  size: z.enum(IMAGE_SIZES).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Describe what the poster should show (at least a few words)." }, { status: 400 });

  const result = await generatePosterImage(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
