import type { Metadata } from "next";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import ServiceCard from "@/components/services/ServiceCard";
import ServicesFilterGrid from "@/components/services/ServicesFilterGrid";
import { getServicesContent } from "@/lib/server/servicesContent";

export const metadata: Metadata = {
  title: "Cleaning Services in Spokane Valley, WA",
  description:
    "Standard, deep, move-in/move-out, bathroom, kitchen, laundry, residential and commercial cleaning services in Spokane Valley, WA. Get a free preliminary estimate.",
  alternates: { canonical: "/services" },
};

// Content is admin-editable from /admin/content — revalidate frequently
// rather than only rebuilding on deploy.
export const revalidate = 60;

export default async function ServicesPage() {
  const allServices = await getServicesContent();
  const active = allServices.filter((s) => s.isActive);
  const [first, ...rest] = active;

  return (
    <>
      <Section className="bg-navy-950 py-14 sm:py-16" ariaLabelledby="services-page-heading">
        <div className="max-w-2xl">
          <Eyebrow>Our services</Eyebrow>
          <h1 id="services-page-heading" className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
            Cleaning services for every stage of home life
          </h1>
          <p className="mt-4 text-surface-200">
            Every service below includes what&apos;s normally covered, optional add-ons, and how
            often we recommend it. Pricing shown across the site is a preliminary estimate —
            final pricing is confirmed after reviewing your property.
          </p>
        </div>
      </Section>

      <Section>
        {first && (
          <Reveal>
            <ServiceCard service={first} featured priority />
          </Reveal>
        )}
        <div className="mt-8">
          <ServicesFilterGrid services={rest} />
        </div>
      </Section>

      <Section className="bg-surface-50 text-center">
        <h2 className="text-2xl font-semibold text-navy-950">Not sure which service fits?</h2>
        <p className="mx-auto mt-2 max-w-md text-surface-700">
          Start an estimate and tell us a bit about your home — we&apos;ll point you in the right
          direction.
        </p>
        <div className="mt-6">
          <Button href="/estimate" size="lg">Get My Free Estimate</Button>
        </div>
      </Section>
    </>
  );
}
