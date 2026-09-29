import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/requireAdmin";
import { getBookingById, deleteBooking } from "@/lib/server/bookingStore";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const booking = await getBookingById(id);
  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ ok: true, booking });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req, "MANAGE_BOOKINGS");
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const result = await deleteBooking(id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.error === "Not found" ? 404 : 400 });
}
