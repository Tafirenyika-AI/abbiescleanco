import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { services } from "@/lib/data/services";

export const metadata: Metadata = {
  title: "Cleaning Services in Spokane Valley, WA",
  description:
    "Standard, deep, move-in/move-out, bathroom, kitchen, laundry, residential and commercial cleaning services in Spokane Valley, WA. Get a free preliminary estimate.",
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-surface-200 transition-shadow hover:shadow-lg"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 30vw, 90vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-semibold text-navy-950">{service.name}</h2>
                <p className="mt-1.5 flex-1 text-sm text-surface-700">{service.shortDescription}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600 group-hover:gap-2">
                  See details <ArrowRight className="size-4 transition-all" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
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
