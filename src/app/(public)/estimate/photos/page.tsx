import type { Metadata } from "next";
import { cookies } from "next/headers";
import Section, { Eyebrow } from "@/components/ui/Section";
import PhotoEstimator from "@/components/estimate/PhotoEstimator";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { services } from "@/lib/data/services";
import { verifyCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/server/customerAuth";

export const metadata: Metadata = {
  title: "Photo Estimate: Snap, Upload, Get a Price",
  description: "Upload photos of your kitchen, bathrooms or living areas and get a cleaning estimate based on what we can see.",
  alternates: { canonical: "/estimate/photos" },
};

export const dynamic = "force-dynamic";

export default async function PhotoEstimatePage() {
  const config = await getPricingConfig();
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(verifyCustomerSessionToken(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value));
  const addOnLabels = Object.fromEntries(config.addOns.map((a) => [a.key, a.label]));
  const serviceNames = Object.fromEntries(services.map((s) => [s.id, s.name]));

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Snap &amp; estimate</Eyebrow>
        <h1 className="mt-2 text-4xl font-semibold text-navy-950 sm:text-5xl">Show us, and we&apos;ll price it</h1>
        <p className="mt-4 text-surface-700">Upload a few photos and we&apos;ll assess how much cleaning each area needs, so your estimate reflects your home, and our crew arrives with the right supplies.</p>
      </div>
      <div className="mx-auto mt-10 max-w-2xl">
        <PhotoEstimator addOnLabels={addOnLabels} serviceNames={serviceNames} isLoggedIn={isLoggedIn} />
        <p className="mt-6 text-center text-sm text-surface-700">Prefer to answer questions instead? <a href="/estimate" className="font-semibold text-teal-700 underline">Use the standard estimate</a>.</p>
      </div>
    </Section>
  );
}
