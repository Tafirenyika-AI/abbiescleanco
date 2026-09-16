import type { Metadata } from "next";
import PolicyLayout from "@/components/policies/PolicyLayout";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the Abbie's Clean Method LLC website and booking requests.",
  alternates: { canonical: "/policies/terms" },
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <PolicyLayout title="Terms of Service" updated="Draft — pending client confirmation">
      <p>
        These terms cover your use of this website and any estimate or booking request you submit
        to {business.name}.
      </p>

      <h2>Estimates are preliminary</h2>
      <p>
        Any price shown on this site — including through the instant estimate tool — is a
        preliminary estimate only. Final pricing is confirmed after we review your property&apos;s
        specific details and is not guaranteed until confirmed in writing.
      </p>

      <h2>Booking requests</h2>
      <p>
        Submitting a preferred date and time is a request, not a confirmed appointment. An
        appointment is confirmed only once our team reviews and approves it.
      </p>

      <h2>Access to your property</h2>
      <p>
        You agree to provide safe, reasonable access to the areas being cleaned, and to disclose
        any known hazards.
      </p>

      <h2>Payment [pending confirmation]</h2>
      <p>
        Payment terms, accepted methods, and any deposit requirements will be confirmed by
        {" "}{business.name} before they are published here.
      </p>

      <h2>Limitation of liability [pending legal review]</h2>
      <p>
        This section requires the business owner&apos;s and/or legal counsel&apos;s input before
        publication and should not be relied upon in its current draft form.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms can be sent to {business.email}.</p>
    </PolicyLayout>
  );
}
