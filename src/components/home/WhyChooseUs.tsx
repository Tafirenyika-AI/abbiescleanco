import Image from "next/image";
import { Check } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Reveal from "@/components/ui/Reveal";

const points = [
  "Personal attention — every home is treated on its own terms, not a checklist.",
  "Consistent, dependable work you can count on visit after visit.",
  "Respect for your home, your time, and your belongings.",
  "Eco-conscious product options available on request.",
  "Family- and pet-conscious cleaning.",
  "Clear communication from your first message to the final walkthrough.",
];

export default function WhyChooseUs() {
  return (
    <Section ariaLabelledby="why-heading">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <Reveal className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl shadow-xl ring-1 ring-navy-950/5 lg:order-1">
          <Image
            src="/images/founder-abigail.jpg"
            alt="Abigail, founder of Abbie's Clean Method, with cleaning supplies"
            fill
            sizes="(min-width: 1024px) 44vw, 90vw"
            className="object-cover"
            loading="lazy"
          />
        </Reveal>
        <Reveal delayMs={120} className="order-1 lg:order-2">
          <Eyebrow>Why Abbie&apos;s Clean Method</Eyebrow>
          <h2 id="why-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            A cleaning partner who treats your home like her own
          </h2>
          <ul className="mt-6 space-y-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-surface-700">{point}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
