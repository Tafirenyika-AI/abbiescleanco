import Section, { Eyebrow } from "@/components/ui/Section";
import { faqs } from "@/lib/data/faqs";

export default function FaqSection() {
  return (
    <Section ariaLabelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Eyebrow>Questions</Eyebrow>
          <h2 id="faq-heading" className="mt-2 text-3xl font-semibold text-navy-950 sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-10 divide-y divide-surface-200 rounded-2xl border border-surface-200">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-5 open:bg-surface-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-950 marker:content-none">
                {faq.question}
                <span className="shrink-0 text-teal-600 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-surface-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
