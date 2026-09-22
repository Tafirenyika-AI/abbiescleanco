import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { whatsappLink, telHref } from "@/lib/data/business";
import { getContactInfo } from "@/lib/server/siteSettings";

export default async function FinalCta() {
  const contact = await getContactInfo();
  return (
    <Section className="bg-teal-500" ariaLabelledby="final-cta-heading">
      <div className="text-center">
        <h2 id="final-cta-heading" className="text-3xl font-semibold text-navy-950 sm:text-4xl">
          Ready to come home to clean?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-navy-900/80">
          Request your free preliminary estimate today, or reach out directly — we&apos;re happy to
          answer any questions first.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="/estimate" variant="secondary" size="lg">
            Get My Free Estimate
          </Button>
          <Button href={telHref(contact.phoneE164)} variant="outline" size="lg" className="border-navy-950 text-navy-950 hover:bg-navy-950 hover:text-white">
            Call {contact.phoneDisplay}
          </Button>
          <Button
            href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.", contact.whatsappE164)}
            external
            variant="ghost"
            size="lg"
            className="text-navy-950 hover:bg-navy-950/10"
          >
            WhatsApp us
          </Button>
        </div>
      </div>
    </Section>
  );
}
