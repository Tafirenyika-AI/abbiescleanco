import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { setActualTimes } from "@/lib/server/bookingStore";

// Plain strings, not z.string().datetime() -- the admin form sends a local `datetime-local` value
// (e.g. "2026-09-30T14:30", no timezone/offset), which setActualTimes parses with `new Date(...)`.
const schema = z.object({
  actualStart: z.string().min(1).nullable().optional(),
  actualEnd: z.string().min(1).nullable().optional(),
});

/** Lets an admin correct the real clock-in/out times -- e.g. the cleaner forgot to tap one. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Validation failed" }, { status: 400 });

  const result = await setActualTimes(id, parsed.data, admin.id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
