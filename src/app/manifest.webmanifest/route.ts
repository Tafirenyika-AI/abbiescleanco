import { NextResponse } from "next/server";

/**
 * Served as a route handler (not the static app/manifest.ts convention) so
 * the file extension in the URL matches what Safari's "Add to Home Screen"
 * and some Android install flows expect literally.
 */
export async function GET() {
  const manifest = {
    name: "Abbie's Clean Method",
    short_name: "Abbie's Clean",
    description: "Come home to clean, book a cleaning in Spokane Valley, WA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b1f33",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
