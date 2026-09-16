import Image from "next/image";
import { ShieldCheck, Sparkles, Leaf } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import { business, whatsappLink } from "@/lib/data/business";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-950" aria-labelledby="hero-heading">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 size-72 rounded-full bg-warm-500/10 blur-3xl" />
      </div>

      <Container className="relative grid grid-cols-1 items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-teal-300">
            <Sparkles className="size-4" aria-hidden />
            Serving {business.city}, {business.region}
          </p>
          <h1 id="hero-heading" className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            Come home to clean.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-surface-200">
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

          <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm text-surface-200">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-teal-400" aria-hidden />
              Locally owned &amp; operated
            </li>
            <li className="flex items-center gap-2">
              <Leaf className="size-4 text-teal-400" aria-hidden />
              Eco-conscious product options
            </li>
          </ul>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
            <Image
              src="/images/hero-living-room.jpg"
              alt="Bright, freshly cleaned living room in a Spokane Valley home"
              fill
              priority
              sizes="(min-width: 1024px) 44vw, 90vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-white p-4 shadow-xl sm:block">
            <p className="font-display text-sm font-semibold text-navy-950">&ldquo;Professional, dependable, and takes genuine pride in her work.&rdquo;</p>
            <p className="mt-1 text-xs text-surface-700">— Jackie Roman, Spokane Valley</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
