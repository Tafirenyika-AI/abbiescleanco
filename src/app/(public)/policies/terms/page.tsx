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
    <PolicyLayout title="Terms of Service" updated="October 6, 2026">
      <p>
        These terms cover your use of this website and any estimate or booking request you submit
        to {business.name}.
      </p>

      <h2>Estimates are preliminary</h2>
      <p>
        Any price shown on this site, including through the instant estimate tool, is a
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

      <h2>SMS Messaging Terms</h2>
      <p>
        <strong>Program:</strong> {business.name} Customer Care Messaging
      </p>
      <p>
        <strong>Purpose:</strong> Transactional/customer-care communications relating to quotes,
        bookings, cleaning appointments, scheduling, service updates, invoices/payments, and
        support -- never unsolicited SMS marketing.
      </p>
      <ul>
        <li><strong>Message frequency:</strong> May vary based on your bookings and activity with us -- there is no fixed number of messages per month.</li>
        <li><strong>Charges:</strong> Message and data rates may apply.</li>
        <li><strong>Opt-out:</strong> Reply <strong>STOP</strong> at any time to unsubscribe from SMS communications.</li>
        <li><strong>Help:</strong> Reply <strong>HELP</strong>, or contact us at {business.email} or {business.phoneDisplay}.</li>
        <li><strong>Consent:</strong> Consent to receive SMS messages is not a condition of purchase.</li>
      </ul>
      <p>
        After opting out, you should no longer receive non-required SMS communications from us
        unless you subsequently opt in again. We do not guarantee message delivery by your mobile
        carrier. See our <a href="/policies/privacy">Privacy Policy</a> for how your mobile
        information is handled.
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
