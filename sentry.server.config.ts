import * as Sentry from "@sentry/nextjs";

/**
 * Loaded by src/instrumentation.ts for the Node.js runtime. Calling Sentry.init() with an empty
 * DSN is the SDK's own documented way to safely no-op -- unlike this app's other integrations
 * (email/SMS/Stripe/Anthropic), which branch to an explicit mock when unconfigured, Sentry is
 * designed to be initialized unconditionally and simply not send anything until a real DSN is
 * set. Set NEXT_PUBLIC_SENTRY_DSN (see .env.example) to start receiving server-side error reports
 * -- there's nothing else to wire up once that's set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  // A DSN-less init already sends nothing; this just keeps local/dev consoles quiet either way.
  enabled: process.env.NODE_ENV === "production",
});
