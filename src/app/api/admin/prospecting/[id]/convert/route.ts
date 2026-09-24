import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { convertProspectToLead } from "@/lib/server/prospectStore";

/** Turns a prospect into a real Lead in the normal pipeline. Requires MANAGE_LEADS since it
 *  creates a real Lead record, same as every other lead-creating action in the admin. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await convertProspectToLead(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
