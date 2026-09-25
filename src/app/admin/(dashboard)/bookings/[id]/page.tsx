import { notFound } from "next/navigation";
import { getBookingById } from "@/lib/server/bookingStore";
import { getIntegrationValue } from "@/lib/server/integrationSettings";
import BookingDetailView from "@/components/admin/bookings/BookingDetailView";

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  // Maps Embed API keys are meant to be used client-side (restricted by HTTP referrer in Google
  // Cloud Console, not kept secret) -- same key already used server-side for Places search.
  const mapsApiKey = (await getIntegrationValue("googleMapsApiKey", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")) ?? null;
  return <BookingDetailView booking={booking} mapsApiKey={mapsApiKey} />;
}
