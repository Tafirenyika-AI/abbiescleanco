# Repository Audit

Date: 2026-09-21. Scope: the actual state of `c:\Users\tafis\Music\abbiescleanco` as found on disk and in the connected Neon database, checked against `ABBIE_AI_OS_MASTER_BLUEPRINT.md`. Everything below is a direct finding (file read, command run, or query run) — nothing here is aspirational. Where the blueprint asks for something this repo doesn't have, it's marked **MISSING**, not described as if it existed.

## 1. Stack and versions (from `package.json`)

- Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5, Tailwind CSS v4.
- Prisma 6.19.3 + `@prisma/client` 6.19.3, targeting PostgreSQL (Neon).
- `zod` 4 + `react-hook-form` for validation.
- `stripe` 22.6.2, `resend` 6.28.1 (email), `@vercel/blob` 2.8.0 (object storage), `sharp` 0.35.4 (image processing), `bcryptjs` (password hashing).
- Test tooling: `vitest` 5 (unit/integration), `@playwright/test` 1.63 (e2e). **No CI workflow exists** (`.github/workflows` is absent) — tests only run when someone runs them locally.
- Deployment target: Vercel (`vercel.json` present, cron configured). **A Vercel project exists and is live** at `https://abbiescleanco.vercel.app/`, auto-deploying from `main` on every push — confirmed 2026-09-22 by fetching it directly and finding it running that session's latest commit (a corrected finding: an earlier version of this document, written from repo-file inspection alone rather than actually checking the live URL, wrongly said this was unconfirmed). See `docs/OPERATIONS.md` §1 for the important caveat: the real business domain, `abbiescleanco.com`, is **not** pointed at this Vercel project — it still serves a separate, pre-existing WordPress site.

## 2. Database — what's really there

Neon Postgres is connected (`DATABASE_URL` in `.env.local`); the app has a mock-JSON fallback (`.data/leads.json`) for parts of the lead flow only, used when `DATABASE_URL` is unset — production always uses real Postgres.

`prisma/schema.prisma` has 30 models, single-tenant (no `organizations`/tenant-scoping table — see §7):

| Area | Models |
|---|---|
| Identity | `AdminUser`, `User`, `Customer` |
| Property | `Address` |
| CRM | `Lead`, `QuoteRequest` |
| Quoting | `Quote`, `QuoteItem`, `PromoCode` |
| Catalog/pricing | `ServiceCatalogItem`, `ServiceAddon` (unused — see §5), `PricingRule` (unused — pricing config actually lives in `BusinessSetting`, see `pricingStore.ts`) |
| Scheduling | `Booking`, `BookingStatusHistory`, `RecurringSchedule` (schema only, no code reads/writes it) |
| Payments | `Payment` (method: CARD/ZELLE/VENMO/APPLE_CASH/CHECK/CASH/OTHER) |
| Comms | `CommunicationPreference`, `Message`, `MessageTemplate` (schema only, unused) |
| Automation | `AutomationEvent` |
| Content | `Review`, `Faq`, `GalleryItem`, `ServiceArea`, `BusinessSetting` |
| Ops | `AuditLog`, `Notification` (legacy, superseded — see below), `AdminNotification`, `ContactMessage` |
| Workforce | `TeamMember`, `Expense` (+`ExpenseCategory`) — flat roster/cost tracking, not subcontractor management (§7) |
| Client-provided detail | `Attachment`, `ClientNote`, `PhotoEstimate` (added 2026-09-19) |

Migrations are additive-only and reviewed by hand before applying — `prisma db push` wiped production once (2026-09-16, recovered via Neon's branch API); the process since is `migrate diff` → read the SQL → apply with `$executeRawUnsafe` → write the migration file for history. See `docs/DECISIONS.md` D-2. This audit did not change that process.

## 3. Working (real, live-verified in prior sessions and/or this one)

- **Public marketing site**: home, services (+ per-service pages), gallery, reviews, about, checklist, contact, policies (5 pages), sitemap.xml/robots.ts.
- **CRM / lead-to-quote (blueprint §3.1, §9 Phase 1)**: `/estimate` (form wizard) and `/estimate/photos` (AI photo estimate) both create a `Lead` + `QuoteRequest`, with `source`/`campaign` captured, a 10-minute duplicate-submission guard (`findRecentDuplicate`), and SMS/email consent stored on `CommunicationPreference` **and actually enforced** — `sendAppointmentReminder` in `src/lib/server/automation.ts` only sends SMS `if (recipient.smsConsent)`. Admin can create/edit/status-change/soft-delete leads (`/admin/leads`) with an `AuditLog`-backed activity timeline.
- **Quotes**: line-item builder, promo-code application, send-by-email, accept/decline (admin and, since 2026-09-19, the customer portal).
- **Bookings + scheduling (§3.3, §9 Phase 2)**: state machine (`REQUESTED → CONFIRMED → SCHEDULED → IN_PROGRESS → COMPLETED`, plus `CANCELLED`/`RESCHEDULED`), admin calendar, self-service booking, admin quick-create, "Schedule booking" from a lead, reschedule (admin and customer), and a 20-minute-early-start lock requiring an approval note. **Double-booking protection was a real gap, fixed this session — see §8.**
- **Customer portal (`/account`)**: signup/login/forgot-reset password, profile, and — as of 2026-09-19 — full self-service management of Requests/Quotes/Bookings/Payments (edit instructions, withdraw, accept/decline quote, cancel/reschedule booking, pay online, attach notes/photos/videos). Every query is scoped to the session's own `customerId`; this was verified this session against another customer's records (13 cross-account attempts all correctly blocked).
- **Payments**: Stripe Checkout (Apple Pay/Google Pay automatic) + 6 manual methods (Zelle, Venmo, Apple Cash, Check, Cash, Other) with a `reference` field, receipt email, webhook-driven status updates. **No Stripe key has been entered** — payments work in mock mode only; this has never been tested against a real Stripe account.
- **AI photo estimate (§3.4 partial)**: customer uploads up to 6 photos, a vision model (Anthropic, via `fetch`, no SDK dependency) classifies condition/add-ons/supplies per photo; **price always comes from the deterministic pricing engine** (`calculateEstimate`), never the model. Crew-only supplies/notes are stored as a `ClientNote` of kind `AI_ASSESSMENT` and hidden from the customer. **No Anthropic key has been entered** — falls back honestly to "standard assumptions" and still queues the photos for a human. Verified only against a mock vision server; real model output quality is untested.
- **Notifications**: transactional email (Resend, mock-logs without a key) with booking confirmation/reminders (48h/24h/day-of, gated on scheduled automation), quote follow-ups, post-service thank-you, manual review-request. SMS via Twilio, same mock fallback. A `NotificationType`/`AdminNotification` feed plus `AuditLog` back an admin activity view.
- **Admin (Executive HQ, partial — §3.7)**: dashboard, leads, customers, quotes, bookings, calendar, payments, promotions, automations (rules + hourly-in-spirit/daily-in-practice cron), activity feed, reports (CSV export), team, expenses, content CMS (services/FAQs/gallery/service areas), reviews moderation, settings (business hours, branding, integration credentials), users (RBAC, see §4), audit log, notifications center. Real TOTP 2FA for admin logins (hand-rolled RFC 6238, no external dependency).
- **Uploads**: `Attachment`/photo-estimate images are magic-byte validated (not trusted MIME/extension), auto-rotated, resized, and re-encoded through `sharp` — this strips EXIF/GPS. Filenames are random 128-bit hex, not derived from anything guessable. Served either via Vercel Blob (production) or a locked-down `/api/uploads/client/[file]` route (local/no-Blob fallback) that validates the filename pattern before reading from disk.
- **Rate limiting**: in-memory sliding window (`checkRateLimit`), applied per-IP to the quote form, booking-slots lookup, and — more tightly — the photo-estimate endpoint (paid model call). **Explicitly documented in the code as not durable across serverless instances** (see §6).
- **Tests**: 35 unit/integration tests (`vitest run`), 3 Playwright e2e specs. All passing as of this audit. Lint baseline: 1 pre-existing error (a deliberate, documented `localStorage`-in-effect pattern in `AdminSidebar`, not a bug) + 2 warnings (React Compiler incompatibility notices, not correctness issues).

## 4. Auth and permissions — what actually exists vs. blueprint §2/§7

- Two **separate** auth systems, no shared "roles" table: `AdminUser` (session cookie, bcrypt password, optional TOTP 2FA, a flat `AdminPermission[]` array — `MANAGE_LEADS/PRICING/CONTENT/REVIEWS/BOOKINGS/USERS`, `VIEW_REPORTS`) and `User`/`Customer` (session cookie, bcrypt password, no 2FA, no roles — every logged-in user is just "a customer").
- **MISSING vs. blueprint**: no `organizations`, `roles`, `permissions`, `memberships` tables; no cleaner/subcontractor/dispatcher/marketer/finance/manager/owner role distinctions (blueprint §2) — there is only "admin" (flat) and "customer." No OAuth (Google/Apple/Facebook) login anywhere — email+password only. Every route hand-rolls its own `requireAdmin`/`requireCustomer` check (verified consistent via this session's IDOR test pass); `src/proxy.ts` (added this session, see `docs/SECURITY.md` §2) now backstops both the admin surface and `/api/account/*` against a future route forgetting that call. The single customer-facing page (`/account`) still relies only on its own page-level check, not the proxy — a deliberate, documented scope decision, not an oversight (see `docs/DECISIONS.md` D-8).
- CSRF-equivalent: same-origin `Origin` header check on customer mutations (`isSameOrigin` in `customerContext.ts`), verified this session to 403 a cross-site request even with a valid cookie. Admin routes were **not** checked for the same protection during this audit — flagged as a follow-up in `docs/SECURITY.md`.

## 5. Explicitly NOT built (net-new per the blueprint, not started)

These are real, honest gaps — not partially built, not "should work":

- **Multi-tenant / multi-location** (`organizations`, `locations`, `service_zones`): single hardcoded business (`src/lib/data/business.ts`), single service area assumption throughout pricing/availability.
- **Marketing studio & omnichannel distribution (§3.2)**: no Google Business Profile, Google Ads, Search Console, Meta/Instagram/Facebook/TikTok integration of any kind. No campaign/creative/approval data model. `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is a placeholder env var with zero wiring — no analytics event of any kind fires today.
- **Cleaner / subcontractor / property-manager portals (§3.5)**: `TeamMember` is a flat roster (name, assigned/completed counts against `Booking.staffAssignee`, a free-text string) — no login, no onboarding, no documents/insurance, no job-offer/accept flow, no time tracking, no CleanPass report. Zero subcontractor concept exists.
- **Finance / accounting (§3.6)**: no `invoices`/`invoice_lines`/`journal_entries`/`payables` tables. `Payment` + `Quote` together function as an informal invoice, and `Expense` is a flat cost log. No QuickBooks or any accounting-platform integration. No receivables aging, no double-entry ledger.
- **Abbie Chat (§4)**: does not exist in any form — no widget, no route registry, no tool registry, no `ai_requests`/`ai_usage` tables.
- **Abbie Vision beyond photo estimation (§3.4)**: no audio/voice upload or transcription pipeline; the existing photo-estimate flow is closer to this section's spirit than any other feature, but it's a synchronous single-purpose estimator, not the described async "customer instructions" pipeline with a structured-scope review/edit/approve step.
- **Google Calendar sync, Google Maps ZIP validation, Cloudflare Turnstile, Sentry, GA4**: all have placeholder env vars in `.env.example` and/or Settings UI fields, and **none are wired into any code path**. This was true before this audit and remains true.
- **CI**: no GitHub Actions or any other CI. Tests, lint, and build are run manually.
- **Durable rate limiting / job queue**: the in-memory rate limiter resets per server instance/restart — fine for a single Vercel instance under light load, not durable at real scale (blueprint §6 explicitly calls for tracked budgets/quotas, which don't exist either — there's no AI cost tracking of any kind, e.g. for the photo-estimate Anthropic calls).

## 6. Real bug found and fixed this session

**Booking double-booking race condition** (blueprint §9 acceptance: *"two users cannot reserve same capacity"* — this was not actually true). `findConflicts()` (a plain read) was called, then `booking.create`/`booking.update` happened as a separate, later write, with no transaction between them. Two concurrent requests for the identical slot (two different customers, or one customer double-submitting) could both pass the conflict check before either committed, creating two bookings for one slot. Confirmed with a real concurrency test against the live database (not simulated): two customers self-booking the same slot simultaneously, and two customers rescheduling onto the same slot simultaneously — both scenarios previously had no code-level protection. See `docs/DECISIONS.md` §D-1 for the fix and its live verification.

## 7. Summary against the blueprint's own phase plan (§9)

| Blueprint phase | Status |
|---|---|
| Phase 0 — audit + architecture + baseline tests | **This document + the rest of `docs/` (done this session).** |
| Phase 1 — CRM + lead-to-quote vertical slice | **Already built and live-verified** (prior sessions). |
| Phase 2 — booking/capacity/confirmations/reminders/portal/auth | **Already built**; the capacity-safety bug in §6 is now fixed. |
| Phase 3 — payments/invoices/financial reporting with verified webhooks | **Partial.** Payments + verified Stripe webhook + reports exist; no formal `invoices` entity, no receivables aging, no accounting integration. |
| Phase 4 — cleaner/partner ops, property-manager portal, CleanPass | **Not started.** |
| Phase 5 — Abbie Chat (read-only, then action tools) | **Not started.** |
| Phase 6 — Abbie Vision upload/processing/confirmation | **Partial** (photo estimate only; no voice, no async review/approve step, no video-frame pipeline). |
| Phase 7 — marketing integrations, approvals, attribution | **Not started.** |
| Phase 8 — forecasting, optimization, hardening, load tests, staged rollout | **Not started.** |
