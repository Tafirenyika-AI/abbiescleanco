# Integrations

Every row below reflects an actual check of `integrationSettings.ts`, `.env.example`, and the code path that would use the credential — not the blueprint's aspirational list. "Wired" means real code calls the provider when a credential is present; "Adapter exists, no credential" means the mock-fallback code path is the only one ever exercised so far; "Not wired" means no code reads the credential at all yet, even though a settings field or env var exists for it.

| Provider | Purpose | Status | Credential entered? |
|---|---|---|---|
| Neon Postgres | Primary database | **Wired, live** | Yes — `DATABASE_URL` set, real data in it. |
| Resend | Transactional email | **Wired**, mock fallback | Not confirmed — falls back to console-logged mock if unset; not verified either way this session. |
| Twilio | SMS/WhatsApp-adjacent notifications | **Wired**, mock fallback | Same as above — not confirmed. |
| Stripe | Card/Apple Pay/Google Pay checkout + webhook | **Wired**, mock fallback | **No** — owner has not entered a key. Real Stripe flow (including the webhook) has never been tested end-to-end against a real Stripe account. |
| Vercel Blob | Object storage for uploads | **Wired** | Conditional — used automatically when `BLOB_READ_WRITE_TOKEN` is present (Vercel sets this itself once Blob is provisioned on the project); local disk fallback otherwise, confirmed working this session. |
| Anthropic (Claude) | Vision model for the photo estimate | **Wired**, mock fallback | **No** — owner has not entered a key. Verified only against a mock vision server this session; real model behavior on real cleaning photos is untested. |
| Google Maps | ZIP/service-area validation | **Not wired.** Settings field exists (`googleMapsApiKey`); ZIP is plain free-text validated by regex only. | N/A |
| Google Calendar | Appointment sync | **Not wired.** Four env vars exist in `.env.example` (client ID/secret/refresh token/calendar ID); no code reads them. | N/A |
| Cloudflare Turnstile | Bot protection | **Not wired.** Settings fields exist (site key + secret); no form actually renders a Turnstile widget or verifies a token server-side. The quote form's only anti-bot measure is a honeypot field. | N/A |
| Sentry | Error reporting | **Wired** (2026-09-21, `@sentry/nextjs`), no mock fallback needed — a DSN-less `Sentry.init()` is the SDK's own documented safe no-op, verified this session (clean production build and server start, zero Sentry-related warnings). Unlike every other integration here, this one **cannot** be activated from `/admin/settings` — it initializes at process/build start, before any database read is possible, so it's env-var-only. | **No** — `NEXT_PUBLIC_SENTRY_DSN` not set. `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are optional extras for source-map upload only; the build succeeds and skips upload cleanly without them. |
| Google Analytics 4 | Analytics | **Not wired — no env var is even read anywhere**, despite `NEXT_PUBLIC_GA4_MEASUREMENT_ID` existing in `.env.example`. No analytics event of any kind fires from this app today. | N/A |
| Google/Apple/Facebook OAuth | Social login | **Does not exist.** No library, no route, no settings field. | N/A |
| Meta (Facebook Page + Instagram) | Automated post publishing | **Wired, real OAuth connect + real Graph API publish**, tested against the real Graph API (a fake token was correctly rejected). | **No** — owner hasn't created the Meta developer app yet. See `docs/SOCIAL_ADS_SETUP.md`. |
| Google Ads | Ad campaign management | **OAuth connect wired and tested** (real account listing). Campaign creation/mutation (budgets, ad groups, ads, targeting) **not built yet** -- next step once a real connection exists. | **No** — owner hasn't created the app/developer token yet. See `docs/SOCIAL_ADS_SETUP.md`. |
| TikTok | Automated post publishing | **OAuth connect wired.** Actual video publish via the Content Posting API **not built yet** -- pending the owner's `video.publish` scope approval from TikTok. | **No** — owner hasn't created the app yet. See `docs/SOCIAL_ADS_SETUP.md`. |
| Google Business Profile, Search Console | Marketing distribution (blueprint §3.2) | **Does not exist.** No adapter, no data model. | N/A |
| QuickBooks (or any accounting platform) | Accounting sync (blueprint §3.6) | **Does not exist.** | N/A |

## What this means for the owner

Nothing above is a code problem — every "not wired" integration is legitimately blocked on either a credential the owner hasn't provided, a developer-app registration (OAuth, Google Business Profile) that requires the owner's business identity, or a scope of work (marketing/accounting integrations) not yet started per the audit in `docs/REPO_AUDIT.md` §5. The two highest-value near-term unlocks, since the code is already written and waiting:

1. **Stripe secret key + webhook signing secret** (`/admin/settings` → Integrations) — unlocks real card/Apple Pay/Google Pay payments. Test in Stripe test mode first; there's no Stripe CLI installed on the dev machine, so use Stripe's dashboard "send test webhook event" feature or a real test-mode Checkout session to verify the webhook path once the key is in.
2. **Anthropic API key** (same Settings page) — unlocks real AI photo assessment instead of the "standard assumptions" fallback. Recommend trying it on a handful of real before/after photos before promoting `/estimate/photos` publicly, since the mock-server testing done this session proves the *plumbing* (price always from the pricing engine, crew-only notes hidden from the customer, honeypot/rate-limit/cross-origin protections) but says nothing about real-model accuracy.
3. **`NEXT_PUBLIC_SENTRY_DSN`** (a Sentry account + project, then a deploy env var — not a Settings field, see above) — the code is fully wired and tested as a safe no-op without it; this is genuinely a one-variable change to get real error visibility into a system that currently has none.
