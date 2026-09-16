import Image from "next/image";
import { HandHeart, CalendarCheck, ShieldCheck, Leaf, PawPrint, MessageCircle } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Reveal from "@/components/ui/Reveal";

const points = [
  { icon: HandHeart, title: "Personal attention", description: "Every home is treated on its own terms, not a generic checklist." },
  { icon: CalendarCheck, title: "Consistent, dependable work", description: "The same quality you can count on, visit after visit." },
  { icon: ShieldCheck, title: "Respect for your home", description: "Your time and your belongings, treated with care." },
  { icon: Leaf, title: "Eco-conscious options", description: "Product choices that are mindful of your home, on request." },
  { icon: PawPrint, title: "Family- & pet-conscious", description: "We work carefully around the people and pets who live there." },
  { icon: MessageCircle, title: "Clear communication", description: "From your first message to the final walkthrough." },
];

export default function WhyChooseUs() {
  return (
    <Section ariaLabelledby="why-heading">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
        <Reveal className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl shadow-xl ring-1 ring-navy-950/5 lg:sticky lg:top-24 lg:order-1">
          <Image
            src="/images/founder-abigail.jpg"
            alt="Abigail, founder of Abbie's Clean Method, with cleaning supplies"
            fill
            quality={90}
            sizes="(min-width: 1024px) 44vw, 90vw"
            className="object-cover"
            loading="lazy"
          />
        </Reveal>
        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow>Why Abbie&apos;s Clean Method</Eyebrow>
            <h2 id="why-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
              A cleaning partner who treats your home like her own
            </h2>
          </Reveal>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {points.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delayMs={i * 70}>
                <div className="h-full rounded-2xl border border-surface-200 p-4.5 transition-colors duration-300 hover:border-teal-200">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <p className="mt-3 font-semibold text-navy-950">{title}</p>
                  <p className="mt-1 text-sm text-surface-700">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
