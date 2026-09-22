# Architecture

Status: describes the system as it exists today, plus how the blueprint's target architecture (§5) should be layered on without a rewrite. This is a working single-tenant Next.js app, not yet the multi-surface "OS" the blueprint describes — see `docs/REPO_AUDIT.md` §5 for exactly what's missing.

## 1. Current shape: a modular monolith (already matches the blueprint's own preference)

```
src/
  app/                     Next.js App Router — route segments double as the API layer
    (public)/              Marketing site + /account (customer portal), route-grouped, own layout
    admin/                 Executive HQ — separate root layout, own auth, no public chrome
    api/                   ~91 route.ts handlers: account/*, admin/*, quote, leads/*, photo-estimate,
                            booking-slots, stripe/webhook, uploads/client/*, automation/process
  lib/
    data/                  Static content fallbacks (business info, service catalog defaults)
    server/                Domain logic — one file per bounded concern (bookingStore, leadStore,
                            quoteStore, paymentStore, clientPortalStore, photoEstimate,
                            automationStore, integrationSettings, requireAdmin, customerContext, ...)
    validation/            Zod schemas, shared between client forms and server routes
  components/              UI, split public/admin/account/estimate — no cross-cutting shared state
prisma/
  schema.prisma            Single source of truth for the data model
  migrations/               Hand-reviewed, additive-only (see docs/DECISIONS.md)
```

There is **no separate API server, no queue/worker process**. Every `route.ts` handler is its own authorization boundary — it calls `requireAdmin()` or `requireCustomer()` (or is deliberately public) and then talks straight to `src/lib/server/*`, which talks straight to Prisma. `src/proxy.ts` (added 2026-09-21, see `docs/SECURITY.md` §2) is a thin, permission-agnostic backstop in front of the admin surface only — it does not replace this per-route pattern, which remains the source of truth for authorization. This is consistent with the blueprint's own instruction ("maintainable TypeScript modular monolith with isolated domain modules") — the domain modules already exist and are already isolated by file, just not yet by a formal package boundary. **Recommendation: keep this shape.** A rewrite into microservices or a formal monorepo is not justified by anything found in this audit and would violate the blueprint's own "preserve working functionality... avoid sweeping rewrites" instruction (§10.3).

## 2. Provider adapters — partially matches blueprint §5 already

The blueprint asks for `AIProvider`, `EmailProvider`, `SMSProvider`, `PaymentProvider`, etc. as named interfaces. What actually exists is the *pattern* without the formal interface: `src/lib/server/email.ts`, `sms.ts`, `stripe.ts`, `photoEstimate.ts` (the closest thing to an `AIProvider`) each:
- Read their credential from `integrationSettings.ts` (DB value, set from `/admin/settings`, falling back to an env var — DB wins if both are set).
- Fall back to a safe, clearly-labeled mock (console-log the email, `mode: "mock"` in the response) when no credential is configured, rather than failing or pretending to send.
- Are instantiated lazily per-call, not at module load, so a credential saved from the admin UI takes effect immediately without a redeploy.

**Gap vs. blueprint**: there's no shared `Provider` TypeScript interface (`capabilities`, `authScopes`, `rateLimits`, `costMetadata`, `health`), no admin "integration hub" UI beyond a flat key/value settings form (`IntegrationsManager.tsx` — configured/not-configured status only, no OAuth connect/reconnect/revoke, no token-expiry alerts, no sandbox-mode toggle separate from "key present or not"). Formalizing this into a real `Provider` interface is worthwhile before adding the next 3+ providers the blueprint requires (Google Ads, Meta, QuickBooks, Google Calendar) — see `docs/IMPLEMENTATION_PLAN.md`.

## 3. Data flow for the two most important vertical slices (as they exist now)

**Lead → Quote → Booking → Payment:**
1. `POST /api/quote` (public, rate-limited 5/10min/IP, honeypot field) → `calculateEstimate()` (pure function, admin-configured rates from `pricingStore.ts`) → `createLead()` writes `Customer`(-or-reuse-if-logged-in) + `Address` + `Lead` + `QuoteRequest`, stores SMS/email consent → confirmation + business-notification emails fire synchronously.
2. Admin builds a `Quote` (`/admin/quotes`) or the system auto-derives one for self-service booking → customer accepts (portal or admin marks it) → `Booking` created via one of 4 write paths (`createBookingFromQuote`, `createSelfServiceBooking`, `scheduleBookingFromLead`, `createAdminBooking`) — all now go through `withSlotLock()` (Postgres `SERIALIZABLE` transaction, see `docs/DECISIONS.md` D-1) for the authoritative conflict check.
3. Payment recorded either via Stripe Checkout webhook (`/api/stripe/webhook`, signature-verified) or manually by admin/customer with one of 6 non-card methods.

**Client-provided detail → crew:**
`Attachment`/`ClientNote` rows are scoped to `(customerId, leadId?, bookingId?)`. The customer portal and the admin lead/booking screens both read the same rows through different, separately-authorized endpoints (`/api/account/thread` vs `/api/admin/client-thread`) — there's no shared "message" abstraction beyond the DB table, which is fine at this scale but would need one if a real two-way SMS/chat channel (blueprint §3.3's "two-way inbound messages") is added later.

## 4. Deployment (target, not yet confirmed live)

Vercel is the target, and it's live: `vercel.json` configures a daily cron (`/api/automation/process`, Hobby-tier limitation — hourly isn't available on Hobby), `next.config.ts` allows Vercel Blob's `*.public.blob.vercel-storage.com` as an image remote pattern, and the upload code path-switches on `BLOB_READ_WRITE_TOKEN` being present. A Vercel project exists, is connected to this GitHub repo, and auto-deploys `main` — confirmed 2026-09-22 at `https://abbiescleanco.vercel.app/`, already running that day's latest commit. **What's not done**: the real domain `abbiescleanco.com` is not pointed at it — see `docs/OPERATIONS.md` §1.

## 5. What changes, and what doesn't, to reach the blueprint's target architecture

**Doesn't change:** the modular-monolith shape, Next.js/Vercel, Neon Postgres, the domain-module-per-file pattern, the provider-adapter-with-mock-fallback pattern.

**Needs to be added, in priority order (see `docs/IMPLEMENTATION_PLAN.md` for sequencing):**
1. A formal `Provider` interface + admin integration hub (before adding more providers).
2. `organizations`/scoping if genuinely multi-location work starts (not needed for one Spokane Valley business — don't build ahead of that requirement).
3. A durable queue/scheduler if anything needs sub-daily-cron timing at real reliability (current daily-cron + "Run now" button is a real, working, but coarse mechanism).
4. Object storage is already private-by-default-URL (random filename) for uploads; blueprint's "signed upload" language is stronger than what exists — direct-to-Blob uploads use Vercel's client-token flow (`/api/account/media/token`), which is the equivalent mechanism, but access control today is "unguessable URL," not "signed, expiring URL." Worth tightening if this becomes a real compliance requirement (see `docs/SECURITY.md`).
