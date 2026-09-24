import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { deleteContactMessage } from "@/lib/server/contactMessageStore";

const schema = z.object({ ids: z.array(z.string().trim().min(1)).min(1).max(200) });

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "No items selected" }, { status: 400 });

  const results = await Promise.all(parsed.data.ids.map((id) => deleteContactMessage(id)));
  const deleted = results.filter(Boolean).length;
  return NextResponse.json({ ok: true, deleted, notFound: parsed.data.ids.length - deleted });
}
