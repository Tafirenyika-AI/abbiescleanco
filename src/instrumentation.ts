import * as Sentry from "@sentry/nextjs";

/** Runtime-appropriate Sentry init, plus the App Router hook Next.js calls automatically on nested server-side rendering/route-handler errors. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
