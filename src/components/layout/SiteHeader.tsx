"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Phone, MessageCircle, User, ChevronRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import TopBar from "./TopBar";
import { telHref, whatsappLink } from "@/lib/data/business";
import type { ContactInfo, BusinessHoursRow } from "@/lib/server/siteSettings";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/checklist", label: "Checklist" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader({ logoUrl, contact, hours }: { logoUrl?: string | null; contact: ContactInfo; hours: BusinessHoursRow[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu on navigation. Adjusting state during render
  // (rather than in an effect) avoids an extra render pass — this is React's
  // recommended pattern for resetting state when a prop/value changes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Fetched client-side (not server-rendered in the root layout) so that
  // marketing pages stay statically generated — account state doesn't need
  // to block or opt out every page from prerendering, just this one widget.
  const [account, setAccount] = useState<{ name: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/me")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json.user) return;
        setAccount({ name: json.user.name || json.user.customer?.firstName || "Account" });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <header className="ios-glass sticky top-0 z-50 border-b border-black/[0.06]">
      <TopBar contact={contact} hours={hours} />
      <Container className="flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${"Abbie's Clean Method"} — Home`}>
          {logoUrl ? (
            // Admin-uploaded logo can be any host — plain <img> avoids requiring
            // every possible source in next.config's remotePatterns.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Abbie's Clean Method logo" width={44} height={44} className="size-11 rounded-full object-cover" />
          ) : (
            <Image
              src="/images/logo.png"
              alt="Abbie's Clean Method logo"
              width={44}
              height={44}
              className="rounded-full"
              priority
            />
          )}
          <span className="font-display text-lg font-semibold text-navy-950 sm:text-xl">
            Abbie&apos;s Clean Method
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-800 transition-colors duration-150 hover:text-teal-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={telHref(contact.phoneE164)}
            aria-label="Call us"
            className="ios-press flex size-10 items-center justify-center rounded-full text-navy-700 hover:bg-surface-100 hover:text-teal-600"
          >
            <Phone className="size-4.5" aria-hidden />
          </a>
          <a
            href={whatsappLink("Hi Abbie's Clean Method! I'd like to ask about a cleaning.", contact.whatsappE164)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on WhatsApp"
            className="ios-press flex size-10 items-center justify-center rounded-full text-navy-700 hover:bg-surface-100 hover:text-teal-600"
          >
            <MessageCircle className="size-4.5" aria-hidden />
          </a>
          <Link
            href={account ? "/account" : "/account/login"}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-navy-700 hover:bg-surface-100 hover:text-teal-600"
          >
            <User className="size-4.5" aria-hidden />
            {account ? account.name.split(" ")[0] : "Sign in"}
          </Link>
          <Button href="/estimate" size="md">
            Get My Free Estimate
          </Button>
        </div>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full text-navy-900 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </Container>

      {open && (
        <div id="mobile-menu" className="ios-sheet-in border-t border-black/[0.06] bg-surface-50/95 lg:hidden">
          <Container className="py-4">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.05]">
              {navLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`ios-press flex items-center justify-between px-4 py-3.5 text-[17px] font-medium text-navy-950 active:bg-surface-100 ${i > 0 ? "border-t border-black/[0.06]" : ""}`}
                >
                  {link.label}
                  <ChevronRight className="size-4 text-navy-800/40" aria-hidden />
                </Link>
              ))}
            </div>
            <Link
              href={account ? "/account" : "/account/login"}
              className="ios-press mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-[17px] font-medium text-navy-950 ring-1 ring-black/[0.05]"
            >
              <span className="flex items-center gap-2.5">
                <User className="size-5 text-teal-600" aria-hidden />
                {account ? `My account (${account.name.split(" ")[0]})` : "Sign in / Create account"}
              </span>
              <ChevronRight className="size-4 text-navy-800/40" aria-hidden />
            </Link>
            <Button href="/estimate" size="lg" className="mt-4 w-full">
              Get My Free Estimate
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
