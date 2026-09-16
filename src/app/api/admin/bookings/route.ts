import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { createBookingFromQuote, findConflicts } from "@/lib/server/bookingStore";

const schema = z.object({
  quoteId: z.string().min(1),
  scheduledStart: z.string().min(1),
  scheduledEnd: z.string().min(1),
  arrivalWindow: z.string().trim().max(100).optional(),
  staffAssignee: z.string().trim().max(100).optional(),
  confirmDespiteConflict: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

  const start = new Date(parsed.data.scheduledStart);
  const end = new Date(parsed.data.scheduledEnd);
  if (!parsed.data.confirmDespiteConflict) {
    const conflicts = await findConflicts(start, end);
    if (conflicts.length > 0) {
      return NextResponse.json({ ok: false, error: "conflict", conflicts }, { status: 409 });
    }
  }

  const result = await createBookingFromQuote(parsed.data.quoteId, parsed.data);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id });
}
