import Image from "next/image";
import { Quote } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import { testimonials } from "@/lib/data/testimonials";

export default function TestimonialsSection() {
  return (
    <Section className="bg-surface-50" ariaLabelledby="testimonials-heading">
      <div className="text-center">
        <Eyebrow>Customer reviews</Eyebrow>
        <h2 id="testimonials-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
          What Spokane Valley is saying
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {testimonials.map((t) => (
          <figure key={t.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-surface-200">
            <Quote className="size-6 text-teal-400" aria-hidden />
            <blockquote className="mt-3 text-navy-900">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {t.avatar && (
                <Image src={t.avatar} alt="" width={40} height={40} className="rounded-full" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-navy-950">{t.name}</p>
                <p className="text-sm text-surface-700">{t.location}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
