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
import { getServicesContent } from "@/lib/server/servicesContent";
import { listGalleryItems, listServiceAreas } from "@/lib/server/content";

export const metadata: Metadata = {
  title: "House Cleaning in Spokane Valley, WA",
  description:
    "Come home to clean. Thoughtful, dependable house cleaning in Spokane Valley — standard, deep, move-in/move-out & recurring service. Get a free preliminary estimate.",
  alternates: { canonical: "/" },
};

// The homepage stays statically generated for performance/SEO, but shows
// admin-editable pricing/services/gallery/service-area content — revalidate
// frequently so an admin change shows up here within a minute rather than
// only on the next deploy.
export const revalidate = 60;

export default async function HomePage() {
  const [pricingConfig, servicesContent, galleryItemsDb, serviceAreasDb] = await Promise.all([
    getPricingConfig(),
    getServicesContent(),
    listGalleryItems(true),
    listServiceAreas(true),
  ]);

  const galleryItems = galleryItemsDb
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      id: g.id,
      src: g.imageUrl,
      alt: g.altText,
      caption: g.caption || "",
      serviceType: g.serviceType || "",
      category: (g.category || "living") as "kitchen" | "bathroom" | "living" | "hallway" | "laundry",
    }));

  return (
    <>
      <Hero />
      <TrustIndicators />
      <ServicesOverview services={servicesContent} />
      <EstimateTeaser pricingConfig={pricingConfig} services={servicesContent} />
      <WhyChooseUs />
      <GalleryPreview items={galleryItems} />
      <HowBookingWorks />
      <ServiceAreaSection areas={serviceAreasDb.map((a) => a.name)} />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
