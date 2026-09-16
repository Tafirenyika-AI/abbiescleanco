"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import TopBar from "./TopBar";

const navLinks = [
  { href: "/services", label: "Services" },
  { href: "/checklist", label: "Checklist" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];

export default function SiteHeader() {
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

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <TopBar />
      <Container className="flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${"Abbie's Clean Method"} — Home`}>
          <Image
            src="/images/logo.png"
            alt="Abbie's Clean Method logo"
            width={44}
            height={44}
            className="rounded-full"
            priority
          />
          <span className="font-display text-lg font-semibold text-navy-950 sm:text-xl">
            Abbie&apos;s Clean Method
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-800 hover:text-teal-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
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
        <div id="mobile-menu" className="border-t border-surface-200 bg-white lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 text-base font-medium text-navy-900 hover:bg-surface-100"
              >
                {link.label}
              </Link>
            ))}
            <Button href="/estimate" size="lg" className="mt-3 w-full">
              Get My Free Estimate
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
