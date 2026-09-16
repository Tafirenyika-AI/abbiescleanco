import { Leaf, Heart, MessageSquare, PawPrint } from "lucide-react";
import Section from "@/components/ui/Section";

const indicators = [
  {
    icon: Heart,
    title: "Family-owned, locally run",
    description: "Founded and led by Abigail, right here in Spokane Valley.",
  },
  {
    icon: Leaf,
    title: "Eco-conscious options",
    description: "Product choices that are mindful of your home and household.",
  },
  {
    icon: PawPrint,
    title: "Pet & family conscious",
    description: "We work carefully around the people and pets who live there.",
  },
  {
    icon: MessageSquare,
    title: "Clear communication",
    description: "You always know what's included, and what happens next.",
  },
];

export default function TrustIndicators() {
  return (
    <Section className="py-10 sm:py-12" ariaLabelledby="trust-heading">
      <h2 id="trust-heading" className="sr-only">
        Why customers trust Abbie&apos;s Clean Method
      </h2>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {indicators.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col items-start gap-2 rounded-2xl border border-surface-200 bg-surface-50 p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="font-semibold text-navy-950">{title}</p>
            <p className="text-sm text-surface-700">{description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
