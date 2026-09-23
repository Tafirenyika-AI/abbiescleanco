# Implementation Plan / Backlog

Mapped to the blueprint's own phase structure (§9), reconciled against what's actually already built (`docs/REPO_AUDIT.md`). Each item has an owner-dependency flag: **[code]** = buildable now with no new credential/decision from the owner, **[creds]** = blocked on a credential the owner needs to enter, **[decision]** = blocked on a business/legal decision only the owner can make.

## Phase 0 — Audit, architecture, baseline (this session)

Done: `docs/REPO_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `docs/OPERATIONS.md`, `docs/DECISIONS.md`, this backlog. Baseline confirmed: 35/35 tests passing, lint at documented baseline (1 pre-existing intentional error, 2 non-correctness warnings), production build clean.

## Phase 1 — CRM + lead-to-quote vertical slice

**Status: already built and live-verified in prior sessions** (`docs/REPO_AUDIT.md` §3). The one real correctness gap found in this area — booking double-booking under concurrency — is fixed this session (`docs/DECISIONS.md` D-1), live-verified with real concurrent requests against the database.

Remaining smaller items in this phase's spirit, not yet done:
- ~~**[code]** Capture UTM parameters (`utm_source`/`utm_medium`/`utm_content`, referrer)~~ **Done 2026-09-22** (`6543779`) — `Lead.utmSource`/`utmMedium`/`utmContent`/`referrer`, captured on the estimate form and visible to admins in the lead detail drawer's new Attribution section.
- ~~**[code]** Store a computed dedup fingerprint (`hash(email, phone, serviceId)`) on `Lead`~~ **Done 2026-09-22** (`4966a0c`) — `Lead.dedupFingerprint`, indexed, now what duplicate-submission detection actually queries against. Fixed a real bug along the way: the database path never filtered by service, so two different services requested by the same contact within 10 minutes were wrongly deduped into one lead.
- **[decision]** Commercial RFP tracker (§3.1) — no evidence this business currently pursues commercial RFPs; don't build speculatively.

## Phase 2 — Booking, capacity, confirmations, reminders, portal, auth

**Status: already built and live-verified**, including the customer portal's full self-service management (accept/decline quotes, cancel/reschedule, pay, attach notes/photos/videos) added 2026-09-19. Capacity-safety bug fixed this session (D-1).

Remaining gaps:
- **[decision]** Recurring service enrollment — `RecurringSchedule` model exists but is entirely unused; `recurringDiscountRates` exist in the pricing engine but are switched off pending owner-approved rates (a prior, deliberate decision, not an oversight). Needs the owner to confirm actual recurring pricing before this is worth building out.
- ~~**[code]** `middleware.ts` defense-in-depth for admin routes~~ **Done 2026-09-21** — `src/proxy.ts` (Next 16 renamed the convention from `middleware.ts`; migrated via `@next/codemod`). See `docs/SECURITY.md` §2 and `docs/DECISIONS.md` D-8.
- ~~**[code]** The equivalent backstop for `/api/account/*`~~ **Done 2026-09-21** — `src/proxy.ts` now covers both surfaces (see `docs/DECISIONS.md` D-8, updated).

## Phase 3 — Payments, invoices, financial reporting

**Status: partial.** Payments (Stripe + 6 manual methods) and reports exist; no formal invoice entity or accounting integration.

- **[creds]** Enter a real Stripe test-mode key and verify the full Checkout → webhook → Payment-marked-PAID → receipt-email path against Stripe's own dashboard test-event sender. This has never been tested against real Stripe infrastructure — everything today is verified against the mock fallback only.
- **[decision]** Whether to build a real `Invoice`/`InvoiceLine` model + PDF generation, or integrate with QuickBooks/similar (blueprint offers both options). This is a real scope decision the owner should make, not something to guess at — a home-grown double-entry ledger (blueprint's fallback option) is a meaningfully larger, higher-stakes build than most of what exists today, and the blueprint itself says to prefer an established accounting platform when possible.
- **[code, once the decision above is made]** Receivables aging report, distinct "billed vs. collected vs. accounting profit" views (blueprint §3.6 explicitly asks these be distinguished — currently `Payment.status=PAID` sums are the only revenue view that exists, via `/admin/reports`).

## Phase 4 — Cleaner/subcontractor/property-manager operations, CleanPass

**Status: not started beyond the flat `TeamMember`/`Expense` roster.** This is a genuinely large, new module:
- **[decision]** Employee vs. subcontractor classification, insurance/licensing requirements, pay structure — all require the owner's actual business practice and likely professional (legal/accounting) review before any code models it, per the blueprint's own instruction (§3.5, §7). Building a subcontractor-agreement/classification system ahead of that would risk encoding wrong assumptions into the business's actual legal exposure.
- **[code, once classification is settled]** Cleaner login + assigned-job view, job-completion checklist, CleanPass report generation, property-manager portal.

## Phase 5 — Abbie Chat (read-only navigation, then confirmed actions)

**Status: levels 1 & 2 done for all three roles (2026-09-22, `2c55204` admin, `15c0955` customer, `076d4d5` guest) — level 3 (confirmed actions) not started.** Three parallel assistants, one pattern, each scoped to what that role should see, per the blueprint's own "guest ... never private account data" / "authenticated customers see only own records" / admin scoped by permission:
- **Admin** — `src/lib/server/assistant.ts` + `POST /api/admin/assistant`, the "Ask Abbie Assistant" bar in the admin header. 7 tools (new leads, pipeline value, conversion rate, net revenue, overdue payments, bookings this week/today, unassigned bookings) authorized through `requireAdmin()`. Live-verified 11/11.
- **Customer** — `src/lib/server/customerAssistant.ts` + `POST /api/account/assistant`, a floating widget on `/account`. 5 tools (next appointment, balance/pending payments, active bookings, quotes awaiting decision, open requests) scoped to `requireCustomer()`. Live-verified 10/10, including a real two-customer isolation test (a second signed-up customer got their own 0, not the first customer's data).
- **Guest** — `src/lib/server/guestAssistant.ts` + `POST /api/guest-assistant`, a floating widget site-wide (hidden on `/account`, which has its own). 8 tools with no identity concept at all (service areas, real admin-configured pricing, hours, contact, WhatsApp, services offered, pet policy, "get an estimate" navigates to the real form) — nothing private to leak by construction. Public and rate-limited (30/10min/IP). Live-verified 11/11.

All three: level 1 (§4 typed route registry + deterministic intent matching) reuses `allNavItems` from `src/lib/admin/nav.ts` for the admin case; no separate registry needed elsewhere since customer/guest tools don't need cross-page navigation the same way. Level 2 (typed, authorized data tools) is real store-function calls, zero model calls anywhere — deterministic keyword matching only, per the blueprint's own §6 instruction not to spend an AI call on navigation or arithmetic a database query already answers.
- ~~**[code]** Level 3 (propose/execute actions after confirmation)~~ **Started 2026-09-22** (`311c0d7`) — admin assistant only so far. "Mark ACM-26-XXXXXX as contacted/confirmed/scheduled/etc." resolves to a `type: "confirm"` result (never executes on the same request); the UI shows explicit Confirm/Cancel; only a confirmed click POSTs to `/api/admin/assistant/execute`, which re-validates the lead's current state, applies `updateLeadStatus` (same function and `MANAGE_LEADS` permission gate the manual status dropdown uses), and writes the same audit log entry. Live-verified 19/19 (propose doesn't mutate, execute does + is real/persisted/audited, unauthenticated execute is rejected, bogus/unknown reference and stale leadId fail cleanly, already-at-that-status short-circuits) + a real Playwright browser pass. **Not yet done**: customer/guest assistant level 3 (no actions proposed for those roles yet), and richer admin action types beyond a lead status change (e.g. "create a quote from lead X", "assign booking Y to \<cleaner\>").
- **[decision/creds]** A real model-backed layer (natural-language queries beyond the fixed keyword sets) needs the Anthropic key already flagged elsewhere in this plan, plus a decision on how much free-text flexibility to allow before it's worth the cost/complexity.

## Phase 6 — Abbie Vision (upload/processing/confirmation)

**Status: partial.** The photo-estimate feature (`/estimate/photos`) already does direct-to-storage upload, MIME/size validation, a structured-output pipeline (condition/add-ons/supplies via a tool-call schema, not free text), and keeps price generation deterministic and separate from the model — this is most of the hard part of §3.4 already done.

Missing from the full §3.4 spec:
- **[creds] partially blocked, 2026-09-22**: owner entered a real Anthropic API key (saved via `/admin/settings` → Integrations, DB-stored like every other integration credential). Tested it directly against `api.anthropic.com` with a real photo: the key authenticates, but it's an **organization-scoped key**, not a workspace-scoped one — every request gets rejected with `invalid_request_error: This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header`. The app has no `anthropicWorkspaceId` setting/field today. Two ways to unblock, owner's call: (a) generate a workspace-scoped key instead from console.anthropic.com (simplest — no code change needed), or (b) give us the workspace ID so a `anthropic-workspace-id` header field can be added to Settings and wired into `photoEstimate.ts`'s `callVision()`. Not guessing at a workspace ID.
- ~~**[code]** Voice/audio upload~~ **partially done 2026-09-22** (`4966a0c`) — customers can attach a voice note (WAV/MP3/OGG/M4A, magic-byte validated, 15MB cap) to a request/booking thread, rendered as a native audio player for both customer and admin views. **Transcription is still not built** — needs a credentialed speech-to-text service (or the same Anthropic key once workspace-scoped, since Claude can transcribe audio); not something to fake with a placeholder.
- ~~**[code]** The explicit "customer reviews/edits/approves the structured scope before it's shared with the crew" step~~ **Done 2026-09-22** (`6543779`) — the customer now sees the same supplies/crew-notes the AI generated, can add their own corrections, and must explicitly choose to share before `linkPhotoEstimateToLead` posts anything to the crew; declining, or never reviewing at all, safely results in no crew note (photos still attach either way).
- **[decision]** After-service photo QA — needs owner sign-off on what claims (if any) are made about it, since the blueprint is explicit that images must never be claimed to prove sanitation.

## Phase 7 — Marketing integrations, approvals, attribution

**Status: not started.** Every item here needs a developer-app registration and/or ad account the owner controls (Google/Meta/TikTok business accounts, API access approval) before any code is useful — building adapters against APIs with no way to test them against a real account would risk exactly the "invented integration status" the blueprint prohibits (§0). **[decision]** first: which channels does the owner actually want to automate, and do they have (or want to create) the business accounts needed. Then **[creds]**, then **[code]**.

## Phase 8 — Forecasting, optimization, hardening, load tests, staged rollout

**Status: not started**, and not meaningfully startable yet — load testing and forecasting need either real production traffic history or a much larger built surface than exists today. The one piece of "hardening" that *is* actionable now, independent of the rest:
- ~~**[code]** Observability~~ **Sentry wired 2026-09-21** (`docs/OPERATIONS.md` §5, `docs/SECURITY.md` §7a) — code-complete, verified as a safe no-op without a DSN. **[creds]** now: just `NEXT_PUBLIC_SENTRY_DSN`.
- **[code]** Durable rate limiting (Upstash Redis or similar) before/if real traffic materializes (`docs/SECURITY.md` §6).

## Suggested near-term order (revenue/risk-adjusted, not phase-numbered)

0. **[decision]** Point `abbiescleanco.com` at the live Vercel deployment (`https://abbiescleanco.vercel.app/`, confirmed live and up to date 2026-09-22 — see `docs/DECISIONS.md`'s correction note and `docs/OPERATIONS.md` §1), or explicitly decide not to yet. Right now the real domain still serves a separate, older WordPress site — none of this rebuild is visible to an actual visitor of `abbiescleanco.com` until this is done. This is the single highest-leverage decision on this whole list: everything below is pointless to a real customer until this happens, and it's entirely the owner's call (it takes the current live site down the moment it's done), not something to do without explicit go-ahead.
1. **[creds]** Stripe test key → verify real payments work. Highest revenue impact of anything code-side; the code is already written and waiting.
2. ~~`middleware.ts`/proxy admin backstop + Sentry wiring~~ **Done 2026-09-21** — both code-complete and live-verified; only Sentry still needs a DSN from the owner.
3. **[creds] blocked, not owner's fault**: Anthropic key entered 2026-09-22 and tested against a real photo — the key itself authenticates, but it's org-scoped and needs an `anthropic-workspace-id` on every request (see Phase 6 note above). Owner needs to either regenerate a workspace-scoped key (simplest) or provide the workspace ID.
4. **[creds]** `NEXT_PUBLIC_SENTRY_DSN` → real error visibility, code already proven safe either way.
5. **[decision]** Invoicing/accounting approach (Phase 3) and workforce/subcontractor classification (Phase 4) — both need the owner's input before more code should be written in those areas, and both gate real further scope.
6. Everything else in Phases 5–8, in the order the owner cares about it — none of it matters until #0 happens.
