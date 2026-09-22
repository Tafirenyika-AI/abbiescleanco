import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getBusinessHours, setBusinessHours } from "@/lib/server/siteSettings";

const schema = z.object({
  hours: z.array(z.object({ days: z.string().trim().min(1).max(60), time: z.string().trim().min(1).max(60) })).max(10),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, hours: await getBusinessHours() });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_CONTENT");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  await setBusinessHours(parsed.data.hours);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
