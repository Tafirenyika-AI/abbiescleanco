import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { updateBookingStatus, getBookingById, BOOKING_STATUSES } from "@/lib/server/bookingStore";
import { notifyAdmins } from "@/lib/server/notificationStore";

const schema = z.object({ status: z.enum(BOOKING_STATUSES), note: z.string().trim().max(500).optional() });

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

  const result = await updateBookingStatus(id, parsed.data.status, admin.id, parsed.data.note);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code, earliest: result.earliest }, { status: result.code === "TOO_EARLY" ? 409 : 400 });
  }

  if (parsed.data.status === "CANCELLED") {
    const booking = await getBookingById(id);
    if (booking) {
      await notifyAdmins("BOOKING_CANCELLED", `Booking cancelled: ${booking.reference}`, booking.customerName, `/admin/bookings/${id}`);
    }
  }

  return NextResponse.json({ ok: true });
}
