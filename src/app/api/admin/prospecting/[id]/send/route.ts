import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { sendProspectOutreach } from "@/lib/server/prospectStore";

/** The explicit admin action that hits this route IS the human-approval step for outreach --
 *  nothing upstream of this ever sends anything on its own. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await sendProspectOutreach(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
