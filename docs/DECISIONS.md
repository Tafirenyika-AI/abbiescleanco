# Architecture Decision Record

Reverse-chronological. Each entry: what was decided, why, what it costs.

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
