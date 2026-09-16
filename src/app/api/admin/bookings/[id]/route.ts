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

  const success = await deleteBooking(id);
  if (!success) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
