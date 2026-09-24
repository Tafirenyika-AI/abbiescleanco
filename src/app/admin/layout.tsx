import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Admin | Abbie's Clean Method",
    template: "%s | Abbie's Clean Method Admin",
  },
  robots: { index: false, follow: false },
};

/**
 * A second, independent root layout (Next.js supports multiple root layouts
 * via route groups/top-level segments) — the admin area is a deliberately
 * different product surface from the public marketing site, so it does not
 * render SiteHeader/SiteFooter/the PWA install prompt at all, rather than
 * nesting an admin shell inside the public chrome.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="admin-site min-h-full text-admin-text">{children}</body>
    </html>
  );
}
