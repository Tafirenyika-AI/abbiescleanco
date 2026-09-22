# Implementation Plan / Backlog

Mapped to the blueprint's own phase structure (§9), reconciled against what's actually already built (`docs/REPO_AUDIT.md`). Each item has an owner-dependency flag: **[code]** = buildable now with no new credential/decision from the owner, **[creds]** = blocked on a credential the owner needs to enter, **[decision]** = blocked on a business/legal decision only the owner can make.

## Phase 0 — Audit, architecture, baseline (this session)

Done: `docs/REPO_AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `docs/OPERATIONS.md`, `docs/DECISIONS.md`, this backlog. Baseline confirmed: 35/35 tests passing, lint at documented baseline (1 pre-existing intentional error, 2 non-correctness warnings), production build clean.

## Phase 1 — CRM + lead-to-quote vertical slice

**Status: already built and live-verified in prior sessions** (`docs/REPO_AUDIT.md` §3). The one real correctness gap found in this area — booking double-booking under concurrency — is fixed this session (`docs/DECISIONS.md` D-1), live-verified with real concurrent requests against the database.

Remaining smaller items in this phase's spirit, not yet done:
- **[code]** Capture UTM parameters (`utm_source`/`utm_medium`/`utm_content`, referrer) on the estimate form, not just `campaign`. Small, additive, improves the attribution the blueprint asks for (§3.1) without needing any new credential.
- **[code]** Store a computed dedup fingerprint (`hash(email, phone, serviceId)`) on `Lead` alongside the existing live-query dedup check, so duplicate detection is auditable/indexed rather than only a runtime heuristic. Low priority — the current mechanism works and is tested; this is a transparency/scale improvement, not a bug fix.
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

**Status: does not exist.** This is genuinely buildable without new external credentials for the read-only navigation tier (§4's "level 1": typed route registry + deterministic intent matching) — it doesn't strictly need a model call for known routes (the blueprint itself says not to spend an AI call on navigation with a known route, §6). The data-retrieval tier (§4's "level 2") needs the same authorization discipline already proven out in the customer portal (`requireCustomer`/`requireAdmin` per call, re-checked server-side, never trusting client-claimed identity) — that pattern already exists and should be reused, not reinvented. The action-execution tier (§4's "level 3") is real net-new scope requiring careful per-action confirmation UX and should come last.
- **[code]** Start with a typed route registry (`route_id`, path template, allowed roles, required permissions) as a standalone module — useful on its own for admin quick-navigation even before any chat UI exists.
- **[code]** Then a small set of read-only, server-authorized "tools" (`get_my_booking`, `search_my_invoices`-equivalent) that reuse `requireCustomer`/`requireAdmin` exactly as the portal APIs already do.
- Full chat UI, voice, and action-execution: defer until the above is proven, per the blueprint's own "no phase skips authorization" instruction (§9).

## Phase 6 — Abbie Vision (upload/processing/confirmation)

**Status: partial.** The photo-estimate feature (`/estimate/photos`) already does direct-to-storage upload, MIME/size validation, a structured-output pipeline (condition/add-ons/supplies via a tool-call schema, not free text), and keeps price generation deterministic and separate from the model — this is most of the hard part of §3.4 already done.

Missing from the full §3.4 spec:
- **[creds]** Enter a real Anthropic key and validate against real photos (currently mock-server-tested only, per `docs/REPO_AUDIT.md`).
- **[code]** Voice/audio upload + transcription — doesn't exist at all.
- **[code]** The explicit "customer reviews/edits/approves the structured scope before it's shared with the crew" step — today the AI assessment is generated and stored directly as a crew-visible note; there's no customer-facing review/edit/approve gate on the AI's own output before it reaches staff. Worth adding given the blueprint explicitly calls for it and it's a meaningful trust/accuracy improvement.
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
3. **[creds]** Anthropic key → validate the photo estimator against real photos before promoting it.
4. **[creds]** `NEXT_PUBLIC_SENTRY_DSN` → real error visibility, code already proven safe either way.
5. **[decision]** Invoicing/accounting approach (Phase 3) and workforce/subcontractor classification (Phase 4) — both need the owner's input before more code should be written in those areas, and both gate real further scope.
6. Everything else in Phases 5–8, in the order the owner cares about it — none of it matters until #0 happens.
