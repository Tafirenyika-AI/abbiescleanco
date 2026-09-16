import { notFound } from "next/navigation";
import { getBookingById } from "@/lib/server/bookingStore";
import BookingDetailView from "@/components/admin/bookings/BookingDetailView";

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  return <BookingDetailView booking={booking} />;
}
