import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { services } from "@/lib/data/services";

export default function ServicesOverview() {
  const featured = services.filter((s) =>
    ["standard-cleaning", "deep-cleaning", "move-in-cleaning", "move-out-cleaning", "bathroom-deep-cleaning", "kitchen-deep-cleaning"].includes(s.id)
  );

  return (
    <Section className="bg-surface-50" ariaLabelledby="services-heading">
      <div className="max-w-2xl">
        <Eyebrow>What we do</Eyebrow>
        <h2 id="services-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
          Services built around your home
        </h2>
        <p className="mt-3 text-surface-700">
          From regular upkeep to a full top-to-bottom reset, choose the service that matches
          where your home is today.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((service) => (
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
              <h3 className="font-display text-lg font-semibold text-navy-950">{service.name}</h3>
              <p className="mt-1.5 flex-1 text-sm text-surface-700">{service.shortDescription}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600 group-hover:gap-2">
                Learn more <ArrowRight className="size-4 transition-all" aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button href="/services" variant="outline" size="lg">
          View all services
        </Button>
      </div>
    </Section>
  );
}
