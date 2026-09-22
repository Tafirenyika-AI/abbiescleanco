import * as Sentry from "@sentry/nextjs";

/** Client-side (browser) init -- Next.js App Router loads this file automatically. See sentry.server.config.ts for why an empty DSN is safe here. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: process.env.NODE_ENV === "production",
});

/** Required by the SDK to trace client-side route changes (App Router navigations). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
