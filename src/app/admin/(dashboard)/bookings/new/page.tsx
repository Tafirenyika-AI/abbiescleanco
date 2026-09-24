import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewBookingForm from "@/components/admin/bookings/NewBookingForm";

export default function NewBookingPage() {
  return (
    <div>
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft className="size-4" aria-hidden /> Back to bookings
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-admin-text sm:text-[28px]">New booking</h1>
      <p className="mt-1 text-sm text-admin-text-muted">For an existing customer booking again, skips the estimate/quote review and confirms directly.</p>
      <div className="mt-6">
        <NewBookingForm />
      </div>
    </div>
  );
}
