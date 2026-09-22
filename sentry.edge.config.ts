import * as Sentry from "@sentry/nextjs";

/** Loaded by src/instrumentation.ts for the Edge runtime (src/proxy.ts and any edge routes). See sentry.server.config.ts for why an empty DSN is safe here. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: process.env.NODE_ENV === "production",
});
