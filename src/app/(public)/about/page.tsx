import type { Metadata } from "next";
import Image from "next/image";
import { Leaf, Heart, MessageSquare, PawPrint } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { business } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "About Us",
  description: `Meet ${business.founder.firstName}, founder of ${business.name}, and learn about our approach to home cleaning in Spokane Valley, WA.`,
  alternates: { canonical: "/about" },
};

const values = [
  { icon: Heart, title: "Personal attention", description: "Every home gets a plan that fits how you actually live in it, not a one-size-fits-all checklist." },
  { icon: MessageSquare, title: "Consistent work & clear communication", description: "You'll always know what to expect, and we'll tell you before anything changes." },
  { icon: Leaf, title: "Eco-conscious options", description: "Product choices that are mindful of your home, on request." },
  { icon: PawPrint, title: "Family- & pet-conscious", description: "We work carefully and respectfully around the people and pets who live there." },
];

export default function AboutPage() {
  return (
    <>
      <Section className="bg-navy-950 py-16 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
              A cleaning business built on care
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-surface-200">{business.founder.story}</p>
            <p className="mt-4 text-surface-200">
              {business.founder.firstName} treats every home the way she&apos;d want her own home
              treated: with respect, attention to detail, and honest communication from start to
              finish.
            </p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
            <Image
              src="/images/founder-abigail.jpg"
              alt={`${business.founder.firstName}, founder of ${business.name}, with her cleaning supplies`}
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </Section>

      <Section ariaLabelledby="approach-heading">
        <div className="max-w-2xl">
          <Eyebrow>Our approach</Eyebrow>
          <h2 id="approach-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            What guides how we clean
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border border-surface-200 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-navy-950">{title}</p>
                <p className="mt-1 text-sm text-surface-700">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-surface-50 text-center">
        <h2 className="text-2xl font-semibold text-navy-950">Ready to work together?</h2>
        <div className="mt-6">
          <Button href="/estimate" size="lg">Get My Free Estimate</Button>
        </div>
      </Section>
    </>
  );
}
