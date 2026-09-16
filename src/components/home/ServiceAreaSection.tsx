import { MapPin } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { business } from "@/lib/data/business";

export default function ServiceAreaSection() {
  return (
    <Section className="bg-navy-950" ariaLabelledby="service-area-heading">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <Eyebrow>Service area</Eyebrow>
          <h2 id="service-area-heading" className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            Proudly serving Spokane Valley &amp; nearby communities
          </h2>
          <p className="mt-3 text-surface-200">
            Not sure if your address is in range? Send us your ZIP code and we&apos;ll let you know.
          </p>
          <div className="mt-6">
            <Button href="/estimate" size="lg">
              Check my address
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <ul className="grid grid-cols-2 gap-3">
            {business.areaServed.map((area) => (
              <li key={area} className="flex items-center gap-2 rounded-xl bg-white/5 px-3.5 py-2.5 text-sm text-white">
                <MapPin className="size-4 shrink-0 text-teal-400" aria-hidden />
                {area}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
