import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "../globals.css";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MobileActionBar from "@/components/layout/MobileActionBar";
import InstallPrompt from "@/components/layout/InstallPrompt";
import { business } from "@/lib/data/business";
import { getBranding } from "@/lib/server/siteSettings";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${business.name} | House Cleaning in Spokane Valley, WA`,
    template: `%s | ${business.name}`,
  },
  description:
    "Thoughtful, dependable home cleaning throughout Spokane Valley — standard, deep, move-in/move-out, and recurring cleaning. Get a free preliminary estimate today.",
  openGraph: {
    type: "website",
    siteName: business.name,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: business.name,
  description: business.tagline,
  telephone: business.phoneE164,
  email: business.email,
  areaServed: business.areaServed.map((a) => ({ "@type": "City", name: a })),
  address: {
    "@type": "PostalAddress",
    addressLocality: business.city,
    addressRegion: business.region,
    addressCountry: "US",
  },
  openingHoursSpecification: business.hoursSchema.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: h.dayOfWeek,
    opens: h.opens,
    closes: h.closes,
  })),
  sameAs: [business.social.tiktok, business.social.facebook].filter(Boolean),
  url: siteUrl,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b1f33" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-navy-950">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        <SiteHeader logoUrl={branding.logoUrl} />
        <main id="main-content" className="flex-1 has-mobile-actionbar">
          {children}
        </main>
        <SiteFooter />
        <MobileActionBar />
        <InstallPrompt />
      </body>
    </html>
  );
}
