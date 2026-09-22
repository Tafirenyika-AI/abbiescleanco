import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MobileActionBar from "@/components/layout/MobileActionBar";
import InstallPrompt from "@/components/layout/InstallPrompt";
import GuestAssistantWidget from "@/components/layout/GuestAssistantWidget";
import { business } from "@/lib/data/business";
import { getBranding, getContactInfo, getBusinessHours, getSocialLinks } from "@/lib/server/siteSettings";
import { listServiceAreas } from "@/lib/server/content";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the tab bar and header extend under the iPhone notch/home-indicator safely
  themeColor: "#0b1f33",
};

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [branding, contact, hours, social, serviceAreas] = await Promise.all([
    getBranding(),
    getContactInfo(),
    getBusinessHours(),
    getSocialLinks(),
    listServiceAreas(true),
  ]);
  const areaNames = serviceAreas.length > 0 ? serviceAreas.map((a) => a.name) : [...business.areaServed];

  // Built here (not at module scope) so the SEO structured data reflects whatever's actually
  // saved in /admin/settings right now, not the static file's defaults -- opening hours are the
  // one field still sourced from the static schema, since the admin-editable hours are free-text
  // ("8:00 AM – 6:00 PM") and schema.org needs structured 24h times; day-to-day precision there
  // isn't worth the risk of mis-parsing free text into wrong structured hours.
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: business.name,
    description: business.tagline,
    telephone: contact.phoneE164,
    email: contact.email,
    areaServed: areaNames.map((a) => ({ "@type": "City", name: a })),
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
    sameAs: [social.tiktok, social.facebook].filter(Boolean),
    url: siteUrl,
  };

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Abbie's Clean" />
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
        <SiteHeader logoUrl={branding.logoUrl} contact={contact} hours={hours} />
        <main id="main-content" className="flex-1 has-mobile-actionbar">
          {children}
        </main>
        <SiteFooter contact={contact} social={social} />
        <MobileActionBar contact={contact} />
        <InstallPrompt />
        <GuestAssistantWidget />
      </body>
    </html>
  );
}
