import type { Metadata } from "next";
import PolicyLayout from "@/components/policies/PolicyLayout";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Abbie's Clean Method LLC collects, uses, and protects your information.",
  alternates: { canonical: "/policies/privacy" },
  robots: { index: false },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout title="Privacy Policy" updated="October 6, 2026">
      <p>
        {business.name} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) respects your privacy. This policy
        explains what information we collect through {business.name.replace(" LLC", "")}&apos;s
        website and how we use it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Contact details you provide (name, email, phone number)</li>
        <li>Property details you provide when requesting an estimate (address/ZIP, property type, size)</li>
        <li>Messages and instructions you send us</li>
        <li>Basic, privacy-conscious analytics about how the site is used (no personal data sent to analytics)</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To respond to estimate requests and provide preliminary pricing</li>
        <li>To schedule, confirm, and manage bookings</li>
        <li>To send confirmations and reminders, plus SMS/WhatsApp updates if you&apos;ve consented to them</li>
        <li>To improve our services</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We use trusted service providers to operate the site and communicate with you, including
        an email delivery provider, an SMS/WhatsApp provider, a database host, and (once enabled)
        a payment processor. We do not sell your information.
      </p>

      <h2>SMS / Text Messaging Privacy</h2>
      <p>
        You may voluntarily provide your mobile phone number and opt in to receive service-related
        SMS text messages from {business.name}. Messages may include quote communications, booking
        confirmations, appointment reminders, scheduling updates, service updates, invoice and
        payment notifications, and responses to customer support inquiries.
      </p>
      <p>
        <strong>
          Mobile information, including phone numbers and SMS opt-in consent data, will not be
          sold or shared with third parties for promotional or marketing purposes.
        </strong>{" "}
        Service providers we use solely to deliver these communications on our behalf (e.g. our
        SMS messaging provider) may process this information as needed to send you the messages
        you&apos;ve requested, subject to their own contractual and privacy safeguards -- never
        for their own marketing or resale.
      </p>
      <ul>
        <li>Message frequency may vary based on your bookings and conversations with us.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> at any time to opt out, or <strong>HELP</strong> for assistance.</li>
        <li>Consent to receive text messages is never a condition of purchasing any service.</li>
        <li>For assistance, contact us at {business.email} or {business.phoneDisplay}.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can opt out of SMS or marketing email at any time. To request access to, correction
        of, or deletion of your information, contact us at {business.email}.
      </p>

      <h2>Access instructions & sensitive details</h2>
      <p>
        Home-access instructions and similar sensitive details you share with us are used only to
        complete your service and are never included in email subject lines or sent to analytics
        tools.
      </p>

      <h2>Questions</h2>
      <p>Contact us at {business.email} or {business.phoneDisplay}.</p>
    </PolicyLayout>
  );
}
