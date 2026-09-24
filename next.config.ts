import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // sharp (used for image re-encoding in mediaUpload.ts) ships a native binary -- without this,
  // Next's bundler can pull it into the serverless function bundle in a way that breaks the
  // native binary at runtime on Vercel specifically (works fine in local dev, where the bundler
  // behaves differently). This keeps sharp as a real external require() at runtime instead.
  serverExternalPackages: ["sharp"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // No account exists yet (see docs/INTEGRATIONS.md) -- without an authToken the plugin skips
  // source-map upload on its own and the app build proceeds normally; nothing else to configure
  // here once SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are set.
  silent: true,
  widenClientFileUpload: true,
});
