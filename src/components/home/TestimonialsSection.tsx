import { Quote, Star } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Reveal from "@/components/ui/Reveal";
import { listPublishedReviews } from "@/lib/server/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-3.5 ${n <= rating ? "fill-warm-500 text-warm-500" : "fill-transparent text-surface-200"}`} aria-hidden />
      ))}
    </div>
  );
}

export default async function TestimonialsSection() {
  const reviews = (await listPublishedReviews()).slice(0, 4);
  if (reviews.length === 0) return null;

  return (
    <Section className="bg-surface-50" ariaLabelledby="testimonials-heading">
      <Reveal className="text-center">
        <Eyebrow>Customer reviews</Eyebrow>
        <h2 id="testimonials-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
          What Spokane Valley is saying
        </h2>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {reviews.map((r, i) => (
          <Reveal key={r.id} delayMs={i * 100}>
            <figure className="h-full glass-card rounded-2xl bg-white p-6 shadow-sm ring-1 ring-surface-200 transition-shadow duration-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <Quote className="size-6 text-teal-400" aria-hidden />
                <Stars rating={r.rating} />
              </div>
              <blockquote className="mt-3 text-navy-900">&ldquo;{r.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                  {r.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-navy-950">{r.authorName}</p>
                  {r.location && <p className="text-sm text-surface-700">{r.location}</p>}
                </div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
