import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";

const steps = [
  {
    step: "1",
    title: "Share your details",
    description: "Tell us about your property and the service you're interested in.",
  },
  {
    step: "2",
    title: "Get a preliminary estimate",
    description: "See a preliminary range right away, or a note that a manual quote is needed.",
  },
  {
    step: "3",
    title: "Pick a preferred date",
    description: "Choose a date and time window that works for you.",
  },
  {
    step: "4",
    title: "We confirm your booking",
    description: "Our team reviews your request and confirms the final details before it's locked in.",
  },
];

export default function HowBookingWorks() {
  return (
    <Section ariaLabelledby="how-it-works-heading">
      <div className="max-w-2xl">
        <Eyebrow>How booking works</Eyebrow>
        <h2 id="how-it-works-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
          Simple from request to confirmed visit
        </h2>
      </div>

      <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.step} className="relative overflow-hidden rounded-2xl border border-surface-200 p-5">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 to-teal-300" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-600">Step 0{s.step}</span>
            <p className="mt-2 font-display text-3xl font-semibold text-navy-950">{s.step}</p>
            <p className="mt-3 font-semibold text-navy-950">{s.title}</p>
            <p className="mt-1.5 text-sm text-surface-700">{s.description}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm text-surface-700">
        A requested time is not a confirmed appointment until our team approves it.
      </p>

      <div className="mt-8">
        <Button href="/estimate" size="lg">
          Start my request
        </Button>
      </div>
    </Section>
  );
}
