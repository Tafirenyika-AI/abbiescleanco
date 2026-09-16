import type { Metadata } from "next";
import { Suspense } from "react";
import Section, { Eyebrow } from "@/components/ui/Section";
import EstimateWizard from "@/components/estimate/EstimateWizard";

export const metadata: Metadata = {
  title: "Get a Free Cleaning Estimate — Spokane Valley, WA",
  description:
    "Get a free, preliminary cleaning estimate in minutes. Tell us about your home and get a quote reference number, sent straight to your email.",
  alternates: { canonical: "/estimate" },
};

export default function EstimatePage() {
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
          <EstimateWizard />
        </Suspense>
      </div>
    </Section>
  );
}
