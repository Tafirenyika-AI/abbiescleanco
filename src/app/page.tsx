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

export const metadata: Metadata = {
  title: "House Cleaning in Spokane Valley, WA",
  description:
    "Come home to clean. Thoughtful, dependable house cleaning in Spokane Valley — standard, deep, move-in/move-out & recurring service. Get a free preliminary estimate.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustIndicators />
      <ServicesOverview />
      <EstimateTeaser />
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
