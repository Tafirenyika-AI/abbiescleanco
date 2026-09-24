import Image from "next/image";
import { ShieldCheck, Sparkles, Leaf, CalendarClock } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { business, whatsappLink } from "@/lib/data/business";
import { getAvailableSlots } from "@/lib/server/bookingAvailability";
import { getPricingConfig } from "@/lib/server/pricingStore";
import { getContactInfo } from "@/lib/server/siteSettings";

/** Real next open slot for the most-requested service, scanned a couple weeks out. Cached by the homepage's own ISR window (60s) -- a friendly heads-up, not a booking guarantee. */
async function nextOpening() {
  try {
    const config = await getPricingConfig();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateISO = d.toISOString().slice(0, 10);
      const slots = await getAvailableSlots("standard-cleaning", dateISO, config);
      if (slots.length > 0) {
        const label = new Date(slots[0].startISO).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
        return { dateLabel: label, timeLabel: slots[0].label };
      }
    }
  } catch {
    // Availability lookup is best-effort decoration on the homepage -- never block the hero on it.
  }
  return null;
}

export default async function Hero() {
  const [opening, contact] = await Promise.all([nextOpening(), getContactInfo()]);

  return (
    <section className="home-hero" aria-labelledby="hero-heading">
      <Container className="hero-grid">
        <div>
          <p className="hero-location"><Sparkles className="size-4" aria-hidden /> Serving {business.city}, {business.region}</p>
          <h1 id="hero-heading" className="hero-title">Your home,<br /><span>spotless.</span></h1>
          <p className="hero-description">Thoughtful, dependable home cleaning throughout Spokane Valley, personalized to your space, schedule, and priorities.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button href="/estimate" size="lg">Get My Free Estimate</Button>
            <Button href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.", contact.whatsappE164)} external variant="outline" size="lg">Message Us on WhatsApp</Button>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs text-surface-700">
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-teal-600" aria-hidden />Locally owned &amp; operated</li>
            <li className="flex items-center gap-2"><Leaf className="size-4 text-teal-600" aria-hidden />Eco-conscious product options</li>
          </ul>
        </div>
        <div className="hero-photo">
          <Image src="/images/hero-living-room.jpg" alt="Bright, freshly cleaned living room in a Spokane Valley home" fill priority quality={90} sizes="(min-width: 1024px) 45vw, 90vw" />
          <span className="hero-photo-label">A little more calm. A lot more clean.</span>
          {opening && (
            <div className="hero-photo-caption">
              <div className="hero-availability">
                <span><CalendarClock className="size-5" aria-hidden /></span>
                <div>
                  <p className="text-xs font-medium text-teal-600">Next opening</p>
                  <p className="mt-0.5 text-sm font-semibold text-navy-950">{opening.dateLabel} · {opening.timeLabel}</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-surface-700">Live availability. Request your estimate to arrange your visit.</p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
