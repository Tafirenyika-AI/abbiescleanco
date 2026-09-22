# Operations

## 1. Environments

- **Local dev**: `npm run dev` (Next dev server). One known machine-specific quirk (documented for whoever runs this next): a corporate Dynatrace APM agent on this dev machine breaks `next dev`'s on-demand compilation for dynamic `[slug]` routes and causes intermittent, page-agnostic hydration warnings in the browser — confirmed an environment artifact, not an app bug, by cleanly reproducing correct behavior via `next build && next start`. If dynamic-route 500s or random hydration warnings show up on this machine, check for that before debugging app code.
- **Production target**: Vercel. **Live and auto-deploying** at `https://abbiescleanco.vercel.app/` — confirmed 2026-09-22 by fetching the site directly and finding it already running a commit pushed minutes earlier (a corrected finding: the version of this document written earlier that day said this was unconfirmed, based only on inspecting repo files rather than actually checking the live URL — a real process mistake, corrected here rather than left standing).
- **The real business domain, `abbiescleanco.com`, is NOT pointed at this Vercel project.** It currently resolves to a separate, pre-existing WordPress site (Apache, hosted on Bluehost per its response headers — unrelated to this codebase). This is presumably the site the business has used until now; this rebuild is not visible there and won't be until the owner (or whoever controls the domain's DNS) points it at Vercel — typically by adding `abbiescleanco.com` as a custom domain in the Vercel project's settings and updating the domain's DNS records (or nameservers) accordingly. **This is a real, unresolved cutover decision** — worth the owner's explicit go-ahead before doing, since it takes the current live site down the moment DNS propagates, in favor of this rebuild.
- **Database**: Neon Postgres, one environment (no separate staging DB confirmed). `DATABASE_URL` in `.env.local` for local dev; production would need its own Vercel-side env var pointing at the same or a separate Neon branch.

## 2. Environment variables (names only — see `.env.example` for the authoritative list; never print real values)

Database: `DATABASE_URL`. Email: `RESEND_API_KEY`, `EMAIL_FROM`. SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Payments: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. AI: `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL` override for testing). Maps: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Calendar: `GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN/CALENDAR_ID` (unused — see `docs/INTEGRATIONS.md`). Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (unused). Analytics: `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (unused). Sentry: `NEXT_PUBLIC_SENTRY_DSN` (the only one required for error capture itself), `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (these three only needed for source-map upload at build time — see `docs/INTEGRATIONS.md`). Cron: `CRON_SECRET` (Vercel sets this automatically for its own cron calls; only needed manually for out-of-band testing). Admin: `ADMIN_SESSION_SECRET`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD`. Uploads: `BLOB_READ_WRITE_TOKEN` (Vercel sets this automatically once Blob storage is provisioned). Site URL: `NEXT_PUBLIC_SITE_URL` (used to build absolute links in emails/Stripe redirects — must be set correctly in production or those links will point at `localhost`).

Every integration credential except `DATABASE_URL`/session secrets can *also* be set from `/admin/settings` → Integrations instead of an env var (DB value wins when both are present) — see `docs/INTEGRATIONS.md`.

## 3. Cron / scheduled work

`vercel.json` runs `GET /api/automation/process` once daily (`0 14 * * *` — 14:00 UTC ≈ 6/7am Pacific depending on DST). This is a **Vercel Hobby-tier limitation** — hourly cron isn't available on Hobby, which is why automation timing (reminder offsets etc.) is coarser than ideal in production. The route also accepts a manual trigger (an admin "Run now" button in `/admin/automations`) authenticated as an admin, independent of the `CRON_SECRET` bearer-token path Vercel itself uses.

## 4. Backups and recovery

Relies entirely on Neon's own point-in-time recovery / branching — no application-level backup job exists. This was exercised for real once already (not a drill): a `prisma db push --accept-data-loss` mistake wiped the production database on 2026-09-16, recovered via Neon's branch API + a cross-branch Prisma data copy (see `docs/DECISIONS.md` for the resulting process change). **No restore drill has been run since** as a rehearsed procedure — the recovery that happened was real incident response, not a planned test. Worth turning into an actual documented/rehearsed runbook if this app starts holding data the business can't afford to reconstruct from memory.

## 5. Monitoring / observability

Sentry (`@sentry/nextjs`) is wired as of 2026-09-21 — server, edge, and client init, plus the App Router `onRequestError`/`onRouterTransitionStart` hooks — but **no DSN has been entered**, so it currently runs as a verified no-op (see `docs/SECURITY.md` §7a). Setting `NEXT_PUBLIC_SENTRY_DSN` in the deploy environment (and redeploying) is the only remaining step. No APM, no uptime check, no log aggregation beyond Vercel's own function logs exist beyond that. `AuditLog` and `AdminNotification` give an in-app activity trail for admin-driven changes, but nothing alerts a human if, say, the automation cron silently stops firing or a webhook starts failing — real error *reporting* is now in place, but alerting/uptime monitoring on top of it is not.

## 6. Rollback

Standard git revert + redeploy (once actually deployed) for application code. For database changes: **never** `prisma db push` in this repo — the established, safe process is `prisma migrate diff --from-url <DB> --to-schema-datamodel prisma/schema.prisma --script`, manual review of the generated SQL to confirm it's purely additive, then apply by hand with `$executeRawUnsafe`, then commit the migration file for history. See `docs/DECISIONS.md` D-2 for why, and the referenced incident-recovery memory for the one time this was skipped and its cost.

## 7. Test/build commands actually available

`npm run lint` (ESLint), `npx tsc --noEmit` (typecheck), `npm test` / `npx vitest run` (35 tests, unit+integration), `npm run test:e2e` (Playwright, 3 specs), `npm run build` (production build — also the only reliable way to smoke-test dynamic routes on this dev machine, see §1). None of these run automatically — there is no CI (`docs/REPO_AUDIT.md` §5).
