# Abbie's Clean Method — Website

Marketing site + lead/estimate pipeline for Abbie's Clean Method LLC (Spokane
Valley, WA). Built with Next.js (App Router), TypeScript, Tailwind CSS, and
Prisma.

See **[CLIENT_CONFIRMATION_CHECKLIST.md](./CLIENT_CONFIRMATION_CHECKLIST.md)**
for everything that needs the business owner's sign-off before this goes live
— pricing, policy language, and a couple of claims the current site makes
that this rebuild intentionally does not repeat without confirmation.

## Stack

- Next.js 16 (App Router, Server Components) + TypeScript + Tailwind CSS v4
- React Hook Form + Zod for the estimate wizard and contact form
- Prisma ORM, targeting PostgreSQL / Supabase
- Resend (email), Twilio (SMS/WhatsApp notifications), Stripe (payments),
  Google Maps / Calendar — all wired as **modular adapters with mock
  fallbacks** so the site runs fully without any of these credentials
- Vitest (unit/integration tests), Playwright (e2e)

## Project status — what's built vs. roadmap

This was implemented in the phased order the spec calls for. **Phases 1–2 are
complete and live-testable end to end.** Phases 3–4 have their data model and
architecture in place but not a full admin UI — see below.

**Phase 1 — done:** design system, header/footer, homepage (all 14 sections),
services overview + 9 individual service pages, cleaning checklist
comparison, about, gallery with filters + lightbox, reviews, contact page,
5 draft policy pages, responsive layout, accessibility pass, base SEO
(metadata, sitemap, robots.txt, LocalBusiness/Service/Breadcrumb JSON-LD).

**Phase 2 — done:** interactive estimate wizard (4-step, validated, saves
progress in-session), a config-driven pricing engine (`src/lib/pricing.ts`)
with every rate editable from `/admin/pricing` (see "Editing pricing"
below), lead persistence (Postgres via Prisma, or a local JSON mock store
when `DATABASE_URL` isn't set), duplicate-submission prevention, honeypot +
rate-limited spam protection, confirmation email to the customer, lead
notification email to the business, WhatsApp handoff with a prefilled
summary, and a basic protected admin dashboard + lead list.

**Phase 3/4 — architecture only, not a full UI:** the full database schema
(`prisma/schema.prisma`) covers quotes, bookings, recurring schedules,
payments, and audit logs. The automation *logic* for follow-ups, reminders,
post-service messages, and win-back campaigns exists as tested, callable
functions in `src/lib/server/automation.ts`, but isn't wired to a live
scheduler yet (see the doc comment at the top of that file for exactly what
that takes — a Vercel Cron job and one new API route). Quote management UI,
a booking calendar, Google Calendar sync, Stripe checkout, and a reporting
dashboard are not built. Treat this as the natural next milestone, not a gap
in what was asked for now — building all of Phase 3/4 out fully is
realistically its own project phase.

## Local setup

```bash
npm install
cp .env.example .env.local   # every var is optional at first — see below
npm run dev
```

Visit `http://localhost:3000`. With no environment variables set, the entire
customer journey still works: estimates calculate, submissions save to
`.data/leads.json`, and emails/SMS are logged to the server console instead
of sent. This is intentional — see `.env.example` for what each integration
needs once you're ready to connect it for real.

> **Known local Windows-only issue:** if this machine has an APM/endpoint
> agent that auto-injects into every Node process (e.g. Dynatrace OneAgent),
> `next dev`'s on-demand worker compilation for the `/services/[slug]` pages
> can 500 due to the agent's own injected script failing to load in that
> worker — this is unrelated to the app and does not reproduce in `next
> build` + `next start`, nor on Vercel. If you hit this, use `npm run build
> && npm run start` instead of `npm run dev` for testing those routes.

## Database

Prisma schema: `prisma/schema.prisma`. Without `DATABASE_URL` set, the app
transparently uses a local JSON mock store for leads — nothing else in the
schema is exercised until you connect a real database.

```bash
# once DATABASE_URL is set (Postgres or Supabase connection string):
npm run db:generate
npm run db:migrate   # creates the initial migration + applies it
npm run db:seed      # safe demo data: services, pricing rules, add-ons, reviews
```

## Editing pricing

Every dollar figure the site shows — base price ranges, the per-extra
bedroom/bathroom/sq-ft scaling, the manual-quote size threshold, condition
multipliers, add-ons (including adding brand-new ones), and the recurring-
discount toggle/rates — lives in one place: `/admin/pricing`, protected by
the same admin login as the lead dashboard.

Nothing in the UI ever hardcodes a price. The estimate wizard, the
homepage's quick-preview estimator, and the server-side calculation behind
every submitted quote all read from the same config, fetched via
`getPricingConfig()` (`src/lib/server/pricingStore.ts`):

- **Without `DATABASE_URL`:** edits save to `.data/pricing-config.json`.
- **With `DATABASE_URL`:** edits save to the `pricing_rules`,
  `service_addons`, and `business_settings` tables — no separate migration
  of these numbers is needed when you connect a real database, since the
  admin panel becomes the source of truth immediately.

The full wizard (`/estimate`) always reads the very latest saved config
(that route is `force-dynamic`). The homepage teaser is statically
generated for performance and revalidates every 60 seconds, so a pricing
change can take up to a minute to show up there specifically — this is
deliberate (see the comment in `src/app/page.tsx`), not a bug.

`src/lib/pricing.ts`'s `defaultPricingConfig` is only the fallback/seed —
edit rates from `/admin/pricing`, not that file, once the site is live.

## Testing

```bash
npm test          # unit + integration tests (Vitest) — pricing math, Zod
                   # validation, honeypot/dedupe/rate-limit behavior of
                   # POST /api/quote
npm run test:e2e   # Playwright — primary customer journey end to end.
                   # Run `npm run build` first; the config starts `next
                   # start` for you (see the Windows note above for why not `next dev`).
```

The admin-pricing e2e suite (`e2e/admin-pricing.spec.ts` — logs in, edits a
price, confirms the wizard reflects it immediately) needs
`ADMIN_DEMO_EMAIL`/`ADMIN_DEMO_PASSWORD` set in the shell running the test
command (not just `.env.local` — the test script itself reads them), and
skips itself with a clear message if they're not set:

```bash
ADMIN_DEMO_EMAIL=admin@abbiescleanco.com ADMIN_DEMO_PASSWORD=... npm run test:e2e
```

## Deployment (Vercel)

1. Push this repo to GitHub (already connected: `Tafirenyika-AI/abbiescleanco`).
2. Import into Vercel, framework preset "Next.js".
3. Add the environment variables you're ready to use from `.env.example`
   (all are optional; add more as each integration goes live).
4. Deploy. Run `npm run db:migrate` against production `DATABASE_URL` once,
   from a machine with access (or a one-off Vercel deployment hook).

## Integration setup guide

Every integration below is a swappable adapter — the mock behavior is the
default, real credentials activate the real thing with no code changes.

| Integration | Where | Env vars | Mock behavior without it |
|---|---|---|---|
| Database | `src/lib/db.ts` | `DATABASE_URL` | Leads saved to `.data/leads.json` |
| Email | `src/lib/server/email.ts` | `RESEND_API_KEY`, `EMAIL_FROM` | Logged to console |
| SMS/WhatsApp notify | `src/lib/server/sms.ts` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Logged to console |
| WhatsApp customer button | `src/lib/data/business.ts` | none — uses `wa.me` links directly | Always works, no API needed |
| Payments | not yet built | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | N/A (Phase 4) |
| Google Maps | not yet wired into a form | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | ZIP is free-text today |
| Google Calendar | not yet built | `GOOGLE_CALENDAR_*` | N/A (Phase 3) |
| Bot protection | not yet wired | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Honeypot field + rate limiting only |
| Analytics | not yet wired | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | No analytics calls made |
| Error reporting | not yet wired | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Errors only in server logs |
| Admin login | `src/lib/server/adminAuth.ts` | `ADMIN_SESSION_SECRET`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD` | Login disabled until set |

## Administrator usage guide (current)

1. Set `ADMIN_SESSION_SECRET`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD` in
   your environment.
2. Visit `/admin/login` and sign in.
3. `/admin` shows lead counts and popular services; `/admin/leads` lists
   every submitted estimate request with contact info and the calculated
   estimate; `/admin/pricing` edits every rate the site quotes with (see
   "Editing pricing" above) — changes apply immediately, no deploy needed.
4. This is a starting point — replace the env-based demo login with real
   `admin_users` table lookups (hashed passwords) before giving real staff
   access. Status changes, notes, and quote creation are Phase 3 work.

## Automation workflow documentation

See the doc comment at the top of `src/lib/server/automation.ts`. Short
version: `NEW_LEAD` fires synchronously today (confirmation + business
notification emails on every estimate submission). The other five
automation types (quote follow-up ×2, booking confirmation, reminders,
post-service/review request, recurring enrollment, win-back) are
implemented as pure functions with unit tests, ready to be called by a
scheduled job once timing values are confirmed by the client (see the
checklist) and a cron trigger is added.

## Backup & recovery recommendations

- Once on Postgres/Supabase: enable automatic daily backups (Supabase does
  this by default) and test a restore before launch.
- `audit_logs` records administrative changes — don't let it be pruned
  without a retention decision.
- The local JSON mock store (`.data/leads.json`) is dev-only and not backed
  up; don't rely on it past initial testing.

## Client launch checklist

See **[CLIENT_CONFIRMATION_CHECKLIST.md](./CLIENT_CONFIRMATION_CHECKLIST.md)**.
Nothing marked "pending confirmation" there should ship to production
without the business owner's explicit sign-off.
