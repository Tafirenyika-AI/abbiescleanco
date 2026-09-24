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
    <PolicyLayout title="Privacy Policy" updated="Draft, pending client confirmation">
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
