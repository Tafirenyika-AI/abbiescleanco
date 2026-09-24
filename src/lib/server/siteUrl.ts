/** The real, publicly reachable base URL this app is running at -- used to build OAuth
 *  redirect URIs that must exactly match what's registered on each platform's developer app. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://abbiescleanco.vercel.app";
}
