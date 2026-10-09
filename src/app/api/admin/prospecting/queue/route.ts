import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { queueTopProspectsForOutreach } from "@/lib/server/prospectStore";
import { checkRateLimit } from "@/lib/server/rateLimit";

const schema = z.object({ count: z.number().int().min(1).max(30) });

/** Ranks the real eligible prospect pool by fit, best-effort fetches missing emails from each
 *  candidate's own website, and queues the top N (applying the admin's default message) for the
 *  paced send queue -- see queueTopProspectsForOutreach's own docstring. This can make real
 *  outbound website requests for several candidates, so it's rate-limited per admin. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_LEADS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit(`prospecting-queue:${admin.id}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "Too many queue requests, please try again in a bit." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a count between 1 and 30" }, { status: 400 });

  const result = await queueTopProspectsForOutreach(parsed.data.count);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
