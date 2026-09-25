import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Share your location | Abbie's Clean Method",
  robots: { index: false, follow: false },
};

/**
 * A third, independent root layout (same pattern as admin's -- see its own comment). Opened by a
 * cleaner on their phone mid-job from a text message link, so it deliberately has none of the
 * marketing site's chrome -- just the one job-specific screen.
 */
export default function TrackRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-navy-950 text-white">{children}</body>
    </html>
  );
}
