import type { Metadata } from "next";
import { Phone, Mail, MessageCircle, Clock, MapPin, AlertCircle } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import ContactForm from "@/components/contact/ContactForm";
import { business, telHref, mailtoHref, whatsappLink } from "@/lib/data/business";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Contact ${business.name} in Spokane Valley, WA by phone, WhatsApp, email, or the form below.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Section className="bg-navy-950 py-14 sm:py-16">
        <div className="max-w-2xl">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="mt-2 text-4xl font-semibold text-white sm:text-5xl">Get in touch</h1>
          <p className="mt-4 text-surface-200">
            Questions, a same-day request, or ready to book — reach us however&apos;s easiest.
          </p>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <a href={telHref()} className="flex items-center gap-3 rounded-2xl border border-surface-200 p-4 hover:border-teal-400">
                <Phone className="size-5 text-teal-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">Call or text</p>
                  <p className="text-sm text-surface-700">{business.phoneDisplay}</p>
                </div>
              </a>
              <a
                href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-surface-200 p-4 hover:border-teal-400"
              >
                <MessageCircle className="size-5 text-teal-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">WhatsApp</p>
                  <p className="text-sm text-surface-700">Message us anytime</p>
                </div>
              </a>
              <a href={mailtoHref()} className="flex items-center gap-3 rounded-2xl border border-surface-200 p-4 hover:border-teal-400">
                <Mail className="size-5 text-teal-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">Email</p>
                  <p className="break-all text-sm text-surface-700">{business.email}</p>
                </div>
              </a>

              <div className="flex items-start gap-3 rounded-2xl border border-surface-200 p-4">
                <Clock className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">Business hours</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-surface-700">
                    {business.hours.map((h) => (
                      <li key={h.days}>{h.days}: {h.time}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-surface-200 p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">Service area</p>
                  <p className="mt-1 text-sm text-surface-700">{business.areaServed.join(", ")}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-warm-100 bg-warm-100/40 p-4">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-warm-600" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-950">Need something urgent?</p>
                  <p className="mt-1 text-sm text-surface-700">
                    Check &ldquo;urgent / same-day&rdquo; on the form, or call/WhatsApp us directly
                    for the fastest response.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-3xl border border-surface-200 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-navy-950">Send us a message</h2>
              <div className="mt-6">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
