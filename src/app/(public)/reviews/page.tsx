import type { Metadata } from "next";
import { Quote, Star } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Reveal from "@/components/ui/Reveal";
import ReviewForm from "@/components/reviews/ReviewForm";
import { listPublishedReviews } from "@/lib/server/reviews";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description: "Real reviews from Spokane Valley customers of Abbie's Clean Method.",
  alternates: { canonical: "/reviews" },
};

// Reviews are admin-moderated and can change at any time — never cache a stale set.
export const dynamic = "force-dynamic";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-4 ${n <= rating ? "fill-warm-500 text-warm-500" : "fill-transparent text-surface-200"}`} aria-hidden />
      ))}
    </div>
  );
}

export default async function ReviewsPage() {
  const reviews = await listPublishedReviews();

  return (
    <>
      <Section className="public-page-heading py-14 sm:py-16">
        <div className="max-w-2xl">
          <Eyebrow>Reviews</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
            What our customers say
          </h1>
          <p className="mt-4 text-surface-200">
            Genuine feedback, published as submitted. We never edit or fabricate a review.
          </p>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {reviews.length === 0 ? (
              <p className="text-surface-700">No published reviews yet — be the first to leave one.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {reviews.map((r, i) => (
                  <Reveal key={r.id} delayMs={(i % 4) * 80}>
                    <figure className="h-full rounded-2xl border border-surface-200 bg-white p-6 transition-shadow duration-300 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <Quote className="size-6 text-teal-400" aria-hidden />
                        <Stars rating={r.rating} />
                      </div>
                      <blockquote className="mt-3 text-navy-900">&ldquo;{r.quote}&rdquo;</blockquote>
                      <figcaption className="mt-4">
                        <p className="font-semibold text-navy-950">{r.authorName}</p>
                        {r.location && <p className="text-sm text-surface-700">{r.location}</p>}
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <ReviewForm />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
