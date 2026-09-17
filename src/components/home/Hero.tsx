import Image from "next/image";
import { ShieldCheck, Sparkles, Leaf } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { business, whatsappLink } from "@/lib/data/business";

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-navy-950 sm:min-h-[92vh]" aria-labelledby="hero-heading">
      <Image
        src="/images/hero-living-room.jpg"
        alt="Bright, freshly cleaned living room in a Spokane Valley home"
        fill
        priority
        quality={90}
        sizes="100vw"
        className="object-cover"
      />
      {/* Two stacked gradients so the left-anchored headline stays legible regardless of what's bright in the photo underneath. */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/45 to-transparent" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/85 via-navy-950/25 to-transparent" aria-hidden />

      <Container className="relative py-12 sm:py-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-teal-300 ring-1 ring-white/15 backdrop-blur-sm">
            <Sparkles className="size-4" aria-hidden />
            Serving {business.city}, {business.region}
          </p>
          <h1 id="hero-heading" className="mt-5 text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
            Your home,
            <br />
            <span className="text-teal-300">spotless.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-surface-100">
            Thoughtful, dependable home cleaning throughout Spokane Valley — personalized to your
            space, schedule, and priorities.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/estimate" size="lg">
              Get My Free Estimate
            </Button>
            <Button
              href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.")}
              external
              variant="outline"
              size="lg"
              className="border-white/40 text-white hover:bg-white hover:text-navy-950"
            >
              Message Us on WhatsApp
            </Button>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm text-surface-100">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-teal-300" aria-hidden />
              Locally owned &amp; operated
            </li>
            <li className="flex items-center gap-2">
              <Leaf className="size-4 text-teal-300" aria-hidden />
              Eco-conscious product options
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
