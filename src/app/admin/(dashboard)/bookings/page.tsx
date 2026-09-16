import { listBookings } from "@/lib/server/bookingStore";
import BookingsView from "@/components/admin/bookings/BookingsView";

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return <BookingsView bookings={bookings} />;
}
