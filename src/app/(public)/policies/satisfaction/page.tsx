import type { Metadata } from "next";
import PolicyLayout from "@/components/policies/PolicyLayout";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Satisfaction & Re-clean Policy",
  description: "What happens if you're not satisfied with a cleaning from Abbie's Clean Method LLC.",
  alternates: { canonical: "/policies/satisfaction" },
  robots: { index: false },
};

export default function SatisfactionPolicyPage() {
  return (
    <PolicyLayout title="Satisfaction & Re-clean Policy" updated="Draft, pending client confirmation">
      <p>
        We want you to be happy with your cleaning. If something was missed, here&apos;s what to
        do.
      </p>

      <h2>How to report an issue</h2>
      <p>
        Contact us at {business.phoneDisplay} or {business.email} and let us know what was missed
        or fell short of expectations.
      </p>

      <h2>Reporting window [pending confirmation]</h2>
      <p>
        The specific number of days after a visit during which a re-clean request can be made has
        not yet been confirmed by the business owner. This section will state that window once
        approved.
      </p>

      <h2>What happens next</h2>
      <p>
        We&apos;ll work with you to make it right, which may include returning to address the
        specific area(s) of concern. Whether re-cleans are offered at no charge, and under what
        conditions, is pending confirmation.
      </p>

      <h2>Honest feedback</h2>
      <p>
        We never ask customers to change genuine feedback, and satisfied customers are welcome,
        never required, to leave a public review.
      </p>
    </PolicyLayout>
  );
}
