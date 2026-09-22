import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ArrowLeft } from "lucide-react";
import Section, { Eyebrow } from "@/components/ui/Section";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { services, isServiceId } from "@/lib/data/services";
import { business, whatsappLink } from "@/lib/data/business";
import { getContactInfo } from "@/lib/server/siteSettings";
import { serviceIcons } from "@/lib/serviceIcons";
import { getServiceContentById } from "@/lib/server/servicesContent";

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.id }));
}

// Content is admin-editable from /admin/content — revalidate frequently
// rather than only rebuilding on deploy.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isServiceId(slug)) return {};
  const service = await getServiceContentById(slug);
  if (!service) return {};
  return {
    title: `${service.name} in Spokane Valley, WA`,
    description: `${service.shortDescription} Serving Spokane Valley, WA. Get a free preliminary estimate for ${service.name.toLowerCase()}.`,
    alternates: { canonical: `/services/${service.id}` },
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isServiceId(slug)) notFound();
  const [service, contact] = await Promise.all([getServiceContentById(slug), getContactInfo()]);
  if (!service) notFound();
  const ServiceIcon = serviceIcons[service.id];

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.name,
    provider: { "@type": "LocalBusiness", name: business.name },
    areaServed: business.areaServed,
    description: service.shortDescription,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Services", item: "/services" },
      { "@type": "ListItem", position: 2, name: service.name, item: `/services/${service.id}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="bg-navy-950 py-10">
        <Container>
          <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 hover:text-teal-200">
            <ArrowLeft className="size-4" aria-hidden /> All services
          </Link>
        </Container>
      </div>

      <Section className="pt-10 sm:pt-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={service.image}
              alt={service.imageAlt}
              fill
              sizes="(min-width: 1024px) 44vw, 90vw"
              className="object-cover"
              quality={90}
              priority
            />
            <span className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-xl bg-white/10 text-teal-300 backdrop-blur-md ring-1 ring-white/15">
              <ServiceIcon className="size-5" aria-hidden />
            </span>
          </div>

          <div>
            <Eyebrow>Service</Eyebrow>
            <h1 className="mt-2 text-4xl font-semibold text-navy-950 sm:text-5xl">{service.name}</h1>
            <p className="mt-4 text-lg text-surface-700">{service.shortDescription}</p>

            <div className="mt-6 rounded-2xl bg-surface-50 p-5">
              <p className="text-sm font-semibold text-navy-950">Who it&apos;s for</p>
              <p className="mt-1 text-sm text-surface-700">{service.forWho}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={`/estimate?service=${service.id}`} size="lg">
                Get a quote for this service
              </Button>
              <Button
                href={whatsappLink(`Hi Abbie's Clean Method! I'd like to ask about ${service.name}.`, contact.whatsappE164)}
                external
                variant="outline"
                size="lg"
              >
                Ask on WhatsApp
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold text-navy-950">What&apos;s normally included</h2>
            <ul className="mt-4 space-y-2.5">
              {service.included.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-surface-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-navy-950">Optional add-ons</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {service.addOns.map((addOn) => (
                <li key={addOn} className="rounded-full bg-teal-100 px-3.5 py-1.5 text-sm font-medium text-teal-700">
                  {addOn}
                </li>
              ))}
            </ul>

            <h2 className="mt-8 text-xl font-semibold text-navy-950">Recommended frequency</h2>
            <p className="mt-3 text-sm text-surface-700">{service.recommendedFrequency}</p>

            <h2 className="mt-8 text-xl font-semibold text-navy-950">How to prepare</h2>
            <ul className="mt-3 space-y-2">
              {service.prepare.map((item) => (
                <li key={item} className="text-sm text-surface-700">• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 text-xs text-surface-700">
          Pricing shown for this service is a preliminary estimate only — final pricing is
          confirmed after we review your property&apos;s specific details.
        </p>
      </Section>

      <Section className="bg-surface-50 text-center">
        <h2 className="text-2xl font-semibold text-navy-950">Ready to book {service.name.toLowerCase()}?</h2>
        <div className="mt-6">
          <Button href={`/estimate?service=${service.id}`} size="lg">Get My Free Estimate</Button>
        </div>
      </Section>
    </>
  );
}
