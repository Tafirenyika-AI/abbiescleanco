import { business } from "@/lib/data/business";

/**
 * The exact SMS consent disclosure text + Privacy/Terms links + "not sold" statement required for
 * the Telnyx 10DLC Customer Care campaign review -- shared by every form that collects a phone
 * number (estimate wizard, photo estimate, contact form, signup) so the wording can never drift
 * between them. Always pair this with your own, separate, unchecked-by-default checkbox input --
 * this component only renders the label content, never the input itself (form state differs
 * between react-hook-form and plain useState across the forms that use it).
 */
export default function SmsConsentDisclosure() {
  return (
    <>
      I agree to receive text messages from {business.name} regarding quotes, bookings,
      appointment reminders, scheduling updates, service updates, payment or invoice
      notifications, and customer support. Message frequency may vary. Message and data rates may
      apply. Consent is not a condition of purchase. Reply STOP to opt out or HELP for help. See
      our{" "}
      <a href="/policies/privacy" className="underline" target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </a>{" "}
      and{" "}
      <a href="/policies/terms" className="underline" target="_blank" rel="noopener noreferrer">
        Terms &amp; Conditions
      </a>
      .
      <span className="mt-1 block text-xs text-surface-600">
        Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.
      </span>
    </>
  );
}
