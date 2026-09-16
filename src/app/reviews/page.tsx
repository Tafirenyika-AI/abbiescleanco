import type { Metadata } from "next";
import Image from "next/image";
import { Quote } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { testimonials } from "@/lib/data/testimonials";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description: "Real reviews from Spokane Valley customers of Abbie's Clean Method.",
  alternates: { canonical: "/reviews" },
};

export default function ReviewsPage() {
  return (
    <>
      <Section className="bg-navy-950 py-14 sm:py-16">
        <div className="max-w-2xl">
          <Eyebrow>Reviews</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">
            What our customers say
          </h1>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {testimonials.map((t) => (
            <figure key={t.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-surface-200">
              <Quote className="size-6 text-teal-400" aria-hidden />
              <blockquote className="mt-3 text-navy-900">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                {t.avatar && <Image src={t.avatar} alt="" width={40} height={40} className="rounded-full" aria-hidden />}
                <div>
                  <p className="font-semibold text-navy-950">{t.name}</p>
                  <p className="text-sm text-surface-700">{t.location}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-10 text-sm text-surface-700">
          Reviews shown here are genuine feedback from real customers. Additional reviews are
          added by our team as they come in.
        </p>
      </Section>

      <Section className="bg-surface-50 text-center">
        <h2 className="text-2xl font-semibold text-navy-950">Had a great experience with us?</h2>
        <p className="mx-auto mt-2 max-w-md text-surface-700">
          We&apos;d love to hear from you — reach out and let us know how your cleaning went.
        </p>
        <div className="mt-6">
          <Button href="/contact" size="lg">Share your feedback</Button>
        </div>
      </Section>
    </>
  );
}
