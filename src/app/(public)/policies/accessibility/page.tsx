import type { Metadata } from "next";
import PolicyLayout from "@/components/policies/PolicyLayout";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "Our commitment to an accessible website for all visitors.",
  alternates: { canonical: "/policies/accessibility" },
  robots: { index: false },
};

export default function AccessibilityPage() {
  return (
    <PolicyLayout title="Accessibility Statement" updated="Draft — pending client confirmation">
      <p>
        {business.name} is committed to making this website usable by as many people as possible,
        including people who use assistive technology.
      </p>

      <h2>Our target standard</h2>
      <p>
        We&apos;ve built this site with the goal of meeting WCAG 2.2 Level AA guidelines, including
        keyboard-accessible navigation, visible focus states, sufficient color contrast, labeled
        form fields, and support for reduced-motion preferences.
      </p>

      <h2>Ongoing work</h2>
      <p>
        Accessibility is an ongoing effort. If you encounter a barrier using this site, please let
        us know so we can address it.
      </p>

      <h2>Contact us</h2>
      <p>
        Reach out at {business.email} or {business.phoneDisplay} to report an accessibility issue
        or request information in an alternate format.
      </p>
    </PolicyLayout>
  );
}
