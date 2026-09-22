# Architecture Decision Record

Reverse-chronological. Each entry: what was decided, why, what it costs.

## Correction — the 2026-09-21 audit's "not deployed" claim was wrong (found 2026-09-22)

`docs/REPO_AUDIT.md`, `docs/ARCHITECTURE.md`, and `docs/OPERATIONS.md` originally stated Vercel deployment was unconfirmed, based on inspecting repository files (`vercel.json`, env var references) rather than actually checking whether a live deployment existed. It does: `https://abbiescleanco.vercel.app/` is live, connected to this GitHub repo, and auto-deploys `main` — confirmed by fetching a route with no corresponding `route.ts` anywhere in the codebase (`/api/admin/totally-fake-route-xyz-check`) and getting back `src/proxy.ts`'s exact JSON response, proving that commit (pushed minutes earlier) was already running live.

Separately, and more importantly: **the real business domain, `abbiescleanco.com`, is not pointed at this Vercel project at all.** It resolves to a distinct, pre-existing WordPress site (Apache, Bluehost-hosted). This rebuild has been live on its Vercel-issued URL this whole time, invisible to anyone checking the real domain, because the domain cutover has never happened. All three documents were corrected in place rather than left standing, per this project's own stated principle of never leaving a known-wrong claim uncorrected.

**Why this happened**: the earlier audit treated "no `.vercel` config artifacts in the repo, no CI, no explicit owner confirmation" as sufficient evidence of non-deployment. It wasn't — a Vercel project can be created and connected entirely through Vercel's own dashboard, leaving no trace in the repository at all. The blueprint's own instruction (§1) to "inspect the deployed website only as context, not proof of backend functionality" was read too narrowly — it's a caution against treating a working frontend as proof the backend works, not license to skip checking the deployed site's existence at all. Worth remembering for any future audit: **check the live URL directly, don't infer deployment status from repo contents alone.**

## D-8 — `src/proxy.ts` admin + customer-account backstop, verified with Web Crypto instead of importing session.ts (2026-09-21, extended same day)

**Decision**: add a project-wide proxy (Next 16's renamed `middleware.ts` convention — see below) that rejects any request under `/admin/*`, `/api/admin/*`, or `/api/account/*` with no valid, unexpired session token of the right scope (`admin` or `customer`), before it reaches route code. It re-implements HMAC verification using the Web Crypto API (`crypto.subtle`) rather than importing `src/lib/server/session.ts` (which uses Node's `crypto` module and isn't available in the Edge runtime the proxy runs in by default). Both scopes share one verification function since admin and customer sessions are signed with the same secret and token format — only the `scope` field and cookie name differ.

**Why**: every admin API route already calls `requireAdmin()`, every `/api/account/*` route already calls `requireCustomer()`, and the admin dashboard pages are protected by their shared layout's own session check — all verified working. But none of that is enforced by the framework; a route added later that simply forgot the call would be silently reachable by anyone. The proxy is a deliberately dumb, fast backstop against exactly that failure mode — it checks "is this signed by us, right scope, not expired," not permissions or DB-backed authorization, both of which stay exactly where they were (`requireAdmin(req, permission)` / `requireCustomer()`'s customer-row lookup).

**Scope decision — what's covered and what isn't**: the single customer-facing page (`/account`) is deliberately **not** covered by the proxy, only its API. `/account` already does its own server-side session check and redirect, and it's one page, not the ~29 the admin dashboard has — the marginal value of a second enforcement layer there is much lower than it was for admin's many pages. The public marketing site and public APIs (`/api/quote`, `/api/booking-slots`, `/api/photo-estimate`, etc.) are untouched, confirmed live.

**Naming note**: Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts` (same mechanism, clearer name — this file runs in front of routing, it isn't a request-handling middleware chain). Migrated automatically via `npx @next/codemod middleware-to-proxy .`, which renamed the file and the exported function (`middleware` → `proxy`) and left everything else unchanged.

**Cost / tradeoff**: the Web Crypto reimplementation duplicates `session.ts`'s token-verification logic in one more place — if the token format in `session.ts` ever changes, `src/proxy.ts` must be updated to match, or it will silently reject every real session (both admin and customer). This is a known, accepted coupling, not an oversight; the alternative (configuring Next's Node-runtime middleware support to allow importing `session.ts` directly) was avoided to keep the proxy on the default, best-supported Edge runtime path.

**Verification**: live-tested against the real running app in two passes. Admin: 6 admin API routes and the dashboard confirmed blocked with no cookie, a forged/garbage cookie rejected cleanly (no 500), all 5 pre-auth admin endpoints (login, 2FA verify, forgot/reset-password, logout) still reachable, real admin login → authenticated API call → authenticated page load all worked end-to-end. 17/17 checks. Customer: 6 `/api/account/*` routes blocked with no cookie, all 6 pre-auth endpoints (signup, login, forgot-password, reset-password, claim, logout) still reachable and a real signup+login worked, a forged customer cookie rejected cleanly, an admin session couldn't call customer endpoints and vice versa, `/account` still redirects via its own check, and the public site/APIs were confirmed unaffected. 23/23 checks.

## D-9 — Sentry wired code-complete, activated by one env var, not the Settings-DB pattern (2026-09-21)

**Decision**: install `@sentry/nextjs`, wire `src/instrumentation.ts` (+ `onRequestError`), `src/instrumentation-client.ts` (+ `onRouterTransitionStart`), `sentry.server.config.ts`, `sentry.edge.config.ts`, and wrap `next.config.ts` with `withSentryConfig`. All four reference `process.env.NEXT_PUBLIC_SENTRY_DSN` directly — **not** `integrationSettings.ts`'s DB-value-with-env-fallback pattern used by every other provider in this app.

**Why**: Sentry initializes once at process/build startup (`Sentry.init()` in each runtime's config, called from `register()`), before any database connection is guaranteed to exist and before any per-request code runs — there's no request in flight yet to read a DB-stored setting from. Trying to force it into the DB-hot-swap pattern the other integrations use would mean either a synchronous DB call blocking cold start, or a real init happening on the *second* request instead of the first — both worse than just using an env var, which is also how Sentry's own tooling (the setup wizard) expects it to be configured. The `sentryDsn` field still exists in `/admin/settings` for visibility/consistency with the other integration rows, but its help text is explicit that saving a value there does nothing.

**Why this is safe to ship without an account**: Sentry's SDK contract guarantees `Sentry.init({ dsn: undefined })` sends nothing and throws nothing — this is documented, intentional behavior, not something this app is relying on undocumented. Verified directly: production build and server start both succeed with zero Sentry-related output, and no network call to Sentry occurs.

**Cost**: none currently (DSN-less, so purely dormant code); once a DSN is set, standard Sentry pricing/data-retention terms apply — an owner decision, not a code one.

## D-1 — Serializable-transaction re-check to close the booking double-booking race (2026-09-21)

**Decision**: wrap the final conflict re-check + booking write (`createSelfServiceBooking`, `scheduleBookingFromLead`, `createAdminBooking` in `bookingStore.ts`; `requestReschedule` in `clientPortalStore.ts`) in a Postgres `SERIALIZABLE` transaction (`withSlotLock()`), retried up to 3 times on a serialization failure (Prisma code `P2034`). The existing fast, non-transactional `findConflicts()` check stays in place *before* this as a cheap early-reject for the common case (good UX, avoids wasted writes) — the transactional re-check is the authoritative one, run immediately before the actual write.

**Why**: `findConflicts()` (read) followed by `booking.create`/`booking.update` (write) as two separate operations is a textbook check-then-act race. Two concurrent requests for the same slot could both pass the check before either committed. This directly contradicted the acceptance criterion "two users cannot reserve same capacity." Confirmed as a genuine, exploitable gap (not theoretical) by running two real concurrent HTTP requests against the live dev database: both self-booking the same slot, and both rescheduling different bookings onto the same slot.

**Verification**: after the fix, the same two concurrency tests were re-run against the live database — in both cases exactly one request succeeded, the other received a clean "that time was just taken" error (not a crash, not a duplicate booking), and the slot correctly disappeared from the availability API afterward. 8/8 checks passed. This could not be captured as a permanent automated test in the existing `vitest` suite because those tests run route handlers in-process against a JSON mock store with no real Postgres transaction semantics to exercise — the live concurrency test was run manually against the real database and its evidence is recorded here rather than as a committed (and likely flaky-under-CI) test file.

**Scope decision**: the admin-only `createBookingFromQuote` and `rescheduleBooking` paths (reached via `/admin/bookings` and `/admin/bookings/[id]/reschedule`) were deliberately **not** given the same hard-blocking treatment. Those routes already support an explicit `confirmDespiteConflict` override — an admin can knowingly double-book two short jobs back-to-back — so making the underlying write unconditionally atomic-and-blocking would remove a real, intentional feature. The race only mattered where a "no" was supposed to be a hard, unconditional no.

**Cost**: a `SERIALIZABLE` transaction is more expensive than a plain read+write and can abort under real contention (by design — that's the point). At this app's current traffic (near zero production traffic, one business, one calendar), this is negligible. Revisit if booking volume grows enough for retry storms to matter.

## D-2 — Never `prisma db push`; always hand-apply reviewed `migrate diff` SQL (2026-09-16, reaffirmed since)

**Decision**: schema changes go: edit `schema.prisma` → `prisma migrate diff --from-url <DB> --to-schema-datamodel prisma/schema.prisma --script` (read-only) → manually confirm the output is purely additive → apply by hand via a small script using `prisma.$executeRawUnsafe` → write the resulting SQL into `prisma/migrations/<timestamp>_<name>/migration.sql` for history → `prisma generate`.

**Why**: `prisma db push --accept-data-loss` was run once against the real production database (adding two columns) and wiped every table to zero rows, despite Prisma's own warning being narrower than what actually happened. Recovered via Neon's branch API + a cross-branch data copy. This is now a hard rule, not a preference.

## D-3 — Stripe Checkout Sessions, not the Payment Element (2026-09-16)

**Decision**: use Stripe's hosted Checkout page rather than embedding Stripe's Payment Element.

**Why**: Apple Pay and Google Pay appear automatically on Stripe's hosted Checkout page for eligible devices/browsers as part of the standard "card" payment method, with zero additional integration code. Embedding the Payment Element would require separately configuring and testing wallet support. Tradeoff: less control over the payment page's look — acceptable for a small business that wants working wallets over a fully custom checkout UI.

## D-4 — Integration credentials as DB-stored JSON with env-var fallback, not a secrets vault (2026-09-16)

**Decision**: `BusinessSetting` (key `"integrations"`) holds provider credentials as plain JSON, settable from `/admin/settings` without a redeploy; every field also has an env-var fallback used only if the DB value is empty.

**Why**: lets the business owner rotate/add credentials themselves through the admin UI instead of needing a Vercel redeploy or a developer for every key change — a real usability win for a non-technical owner. Explicitly documented in code as a pragmatic tradeoff, not a secrets vault: protected only by DB access control + TLS in transit, not encrypted at the application layer. Acceptable at this app's current risk level (a small business's own API keys, not customer financial data — no card numbers ever touch this app given D-3). Revisit if the credential set expands to something higher-stakes.

## D-5 — Single-tenant schema; no `organizations`/multi-tenant scaffolding (ongoing, reaffirmed 2026-09-21)

**Decision**: the schema models one business directly (`src/lib/data/business.ts` is a static config, not a row in a table), with no tenant-scoping column anywhere.

**Why**: the blueprint's suggested table list includes `organizations`/`locations`/`service_zones`, but nothing in this repo or from the owner indicates a second tenant/location is imminent. Adding a tenant foreign key to every table and a tenant filter to every query, for a hypothetical second business that may never exist, would add real complexity and bug surface (a forgotten tenant filter is a cross-tenant data leak) for no current benefit. If genuine multi-location/multi-tenant need materializes, this should be a deliberate, reviewed migration — not something retrofitted quietly.

## D-6 — Magic-byte upload validation + full re-encode, not trust-the-MIME-type (2026-09-19)

**Decision**: every customer-uploaded image is identified by its actual byte signature (not the browser-supplied `Content-Type` or filename), and re-encoded through `sharp` (which also strips all EXIF/GPS metadata) before storage. SVG is not an accepted upload type at all.

**Why**: browser-supplied MIME types and extensions are attacker-controlled. A file claiming to be `image/jpeg` with a `.jpg` name can contain anything. Re-encoding rather than just validating also means a successfully "validated" file can't smuggle a polyglot payload through unmodified — decode-then-re-encode collapses anything that isn't genuinely a raster image. Verified this session: a fake-magic-bytes file and an SVG were both rejected; a real EXIF marker was confirmed absent from the stored output.

## D-7 — Random 128-bit filenames instead of derived/sequential ones, URL-based access instead of a signed-URL scheme (2026-09-19)

**Decision**: stored media filenames are `crypto.randomUUID()`-derived hex, not based on the original filename, customer ID, or a sequential ID. Access to a file is "know the URL," not a separate authorization check per file fetch.

**Why**: cheap, effective protection against enumeration (sequential or derivable IDs would let one customer guess another's file URLs) without the complexity of a signed-URL-with-expiry scheme. Documented in `docs/SECURITY.md` §5 as weaker than true per-request authorization — accepted for now given the data sensitivity (cleaning-job photos, not financial/identity documents), revisit if that changes.
