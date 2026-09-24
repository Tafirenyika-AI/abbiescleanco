import type { Metadata } from "next";
import PolicyLayout from "@/components/policies/PolicyLayout";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Cancellation & Rescheduling Policy",
  description: "How to cancel or reschedule an appointment with Abbie's Clean Method LLC.",
  alternates: { canonical: "/policies/cancellation" },
  robots: { index: false },
};

export default function CancellationPolicyPage() {
  return (
    <PolicyLayout title="Cancellation & Rescheduling Policy" updated="Draft, pending client confirmation">
      <p>We understand plans change. Here&apos;s how to cancel or reschedule a confirmed appointment.</p>

      <h2>How to cancel or reschedule</h2>
      <p>
        Contact us by phone, WhatsApp, or email at {business.phoneDisplay} / {business.email} as
        soon as you know you need to change your appointment.
      </p>

      <h2>Notice period [pending confirmation]</h2>
      <p>
        The amount of advance notice requested for a free cancellation or reschedule (for example,
        24 or 48 hours) has not yet been confirmed by the business owner. This section will state
        that specific window once approved.
      </p>

      <h2>Late cancellation or no-show [pending confirmation]</h2>
      <p>
        Whether a fee applies for late cancellations or no-shows, and the amount of any such fee,
        has not yet been confirmed. No fee is charged unless and until this policy is finalized
        and published.
      </p>

      <h2>Business-initiated changes</h2>
      <p>
        If we need to reschedule your appointment (for example, due to weather or an emergency),
        we&apos;ll contact you as soon as possible to find a new time.
      </p>
    </PolicyLayout>
  );
}
