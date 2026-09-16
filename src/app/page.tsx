import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import TrustIndicators from "@/components/home/TrustIndicators";
import ServicesOverview from "@/components/home/ServicesOverview";
import EstimateTeaser from "@/components/home/EstimateTeaser";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import GalleryPreview from "@/components/home/GalleryPreview";
import HowBookingWorks from "@/components/home/HowBookingWorks";
import ServiceAreaSection from "@/components/home/ServiceAreaSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FaqSection from "@/components/FaqSection";
import FinalCta from "@/components/home/FinalCta";
import { getPricingConfig } from "@/lib/server/pricingStore";

export const metadata: Metadata = {
  title: "House Cleaning in Spokane Valley, WA",
  description:
    "Come home to clean. Thoughtful, dependable house cleaning in Spokane Valley — standard, deep, move-in/move-out & recurring service. Get a free preliminary estimate.",
  alternates: { canonical: "/" },
};

// The homepage stays statically generated for performance/SEO, but the
// estimate teaser shows admin-editable pricing — revalidate frequently so an
// admin pricing change shows up here within a minute rather than only on
// the next deploy. The full wizard at /estimate is always fully fresh
// (force-dynamic there) since that's what actually calculates a submitted
// quote.
export const revalidate = 60;

export default async function HomePage() {
  const pricingConfig = await getPricingConfig();

  return (
    <>
      <Hero />
      <TrustIndicators />
      <ServicesOverview />
      <EstimateTeaser pricingConfig={pricingConfig} />
      <WhyChooseUs />
      <GalleryPreview />
      <HowBookingWorks />
      <ServiceAreaSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
