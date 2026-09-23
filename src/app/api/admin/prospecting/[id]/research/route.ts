import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { researchProspect } from "@/lib/server/prospectStore";

/** Runs real web research on a specific prospect via Claude's web_search tool. Always an explicit
 *  admin click -- never triggered automatically, since each call has a real API cost. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await researchProspect(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
