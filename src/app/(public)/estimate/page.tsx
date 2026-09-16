import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Section, { Eyebrow } from "@/components/ui/Section";
import EstimateWizard from "@/components/estimate/EstimateWizard";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getServicesContent } from "@/lib/server/servicesContent";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";

export const metadata: Metadata = {
  title: "Get a Free Cleaning Estimate — Spokane Valley, WA",
  description:
    "Get a free, preliminary cleaning estimate in minutes. Tell us about your home and get a quote reference number, sent straight to your email.",
  alternates: { canonical: "/estimate" },
};

// Pricing is admin-editable and must never be served stale — render this
// page fresh on every request instead of at build time.
export const dynamic = "force-dynamic";

export default async function EstimatePage() {
  const [pricingConfig, servicesContent] = await Promise.all([getPricingConfig(), getServicesContent()]);
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(verifyCustomerSessionToken(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value));

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Free instant estimate</Eyebrow>
        <h1 className="mt-2 text-4xl font-semibold text-navy-950 sm:text-5xl">
          Let&apos;s build your estimate
        </h1>
        <p className="mt-4 text-surface-700">
          A few quick questions and you&apos;ll have a preliminary estimate and a reference
          number — no obligation.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <Suspense fallback={<div className="text-center text-surface-700">Loading estimator…</div>}>
          <EstimateWizard pricingConfig={pricingConfig} isLoggedIn={isLoggedIn} services={servicesContent} />
        </Suspense>
      </div>
    </Section>
  );
}
