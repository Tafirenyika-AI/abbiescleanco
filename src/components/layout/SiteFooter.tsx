import Link from "next/link";
import Image from "next/image";
import { Phone, Mail, MapPin } from "lucide-react";
import Container from "@/components/ui/Container";
import { business, telHref, mailtoHref, whatsappLink } from "@/lib/data/business";
import { services } from "@/lib/data/services";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy-950 text-surface-200">
      <Container className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo.png" alt="" width={40} height={40} className="rounded-full" aria-hidden />
            <span className="font-display text-lg font-semibold text-white">Abbie&apos;s Clean Method</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed">{business.tagline}</p>
          <div className="mt-4 flex gap-3">
            {business.social.tiktok && (
              <a href={business.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-teal-300">
                TikTok
              </a>
            )}
            {business.social.facebook && (
              <a href={business.social.facebook} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-teal-300">
                Facebook
              </a>
            )}
          </div>
        </div>

        <nav aria-label="Services">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Services</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {services.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/services/${s.id}`} className="hover:text-teal-300">
                  {s.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/services" className="hover:text-teal-300">
                View all services
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Company</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/about" className="hover:text-teal-300">About</Link></li>
            <li><Link href="/gallery" className="hover:text-teal-300">Gallery</Link></li>
            <li><Link href="/reviews" className="hover:text-teal-300">Reviews</Link></li>
            <li><Link href="/checklist" className="hover:text-teal-300">Cleaning Checklist</Link></li>
            <li><Link href="/contact" className="hover:text-teal-300">Contact</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Get in touch</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a href={telHref()} className="flex items-center gap-2 hover:text-teal-300">
                <Phone className="size-4 shrink-0" aria-hidden /> {business.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={mailtoHref()} className="flex items-center gap-2 hover:text-teal-300 break-all">
                <Mail className="size-4 shrink-0" aria-hidden /> {business.email}
              </a>
            </li>
            <li>
              <a
                href={whatsappLink("Hi Abbie's Clean Method! I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teal-300"
              >
                Message us on WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="size-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                Serving {business.city}, {business.region} and nearby areas
              </span>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center gap-3 py-6 text-xs text-surface-200/80 sm:flex-row sm:justify-between">
          <p>
            © {year} {business.legalName}. All rights reserved.
          </p>
          <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/policies/privacy" className="hover:text-teal-300">Privacy Policy</Link>
            <Link href="/policies/terms" className="hover:text-teal-300">Terms of Service</Link>
            <Link href="/policies/cancellation" className="hover:text-teal-300">Cancellation Policy</Link>
            <Link href="/policies/satisfaction" className="hover:text-teal-300">Satisfaction Policy</Link>
            <Link href="/policies/accessibility" className="hover:text-teal-300">Accessibility</Link>
          </nav>
        </Container>
      </div>
    </footer>
  );
}
