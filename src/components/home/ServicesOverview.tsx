import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import ServiceCard from "@/components/services/ServiceCard";
import { services } from "@/lib/data/services";

export default function ServicesOverview() {
  const featured = services.filter((s) =>
    ["standard-cleaning", "deep-cleaning", "move-in-cleaning", "move-out-cleaning", "bathroom-deep-cleaning", "kitchen-deep-cleaning"].includes(s.id)
  );
  const [hero, ...rest] = featured;

  return (
    <Section className="bg-surface-50" ariaLabelledby="services-heading">
      <Reveal className="max-w-2xl">
        <Eyebrow>What we do</Eyebrow>
        <h2 id="services-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
          Services built around your home
        </h2>
        <p className="mt-3 text-surface-700">
          From regular upkeep to a full top-to-bottom reset, choose the service that matches
          where your home is today.
        </p>
      </Reveal>

      {/* Mobile: swipeable, app-like carousel. Desktop: an editorial layout with one featured service. */}
      <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:hidden [&>*]:w-[82vw] [&>*]:max-w-sm">
        {featured.map((service) => (
          <ServiceCard key={service.id} service={service} priority={service.id === hero.id} />
        ))}
      </div>

      <div className="mt-10 hidden sm:block">
        <Reveal>
          <ServiceCard service={hero} featured priority />
        </Reveal>
        <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-3">
          {rest.map((service, i) => (
            <Reveal key={service.id} delayMs={i * 80}>
              <ServiceCard service={service} />
            </Reveal>
          ))}
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Button href="/services" variant="outline" size="lg">
          View all services
        </Button>
      </div>
    </Section>
  );
}
