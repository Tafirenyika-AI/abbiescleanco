# Security

Status: an honest account of what's actually enforced today (verified by test, not assumed), what's genuinely missing, and what needs a professional/legal review the owner hasn't yet obtained (per blueprint §7, "no blanket claims of legal compliance without review" — this document makes none).

## 1. Authentication

Two separate, unrelated auth systems (see `docs/ARCHITECTURE.md` §1 for why): `AdminUser` and `User`/`Customer`. Both use signed session cookies (`src/lib/server/session.ts`), bcrypt-hashed passwords, `httpOnly`/`sameSite=lax` cookies. Admin additionally supports real TOTP 2FA (RFC 6238, hand-rolled on Node's `crypto`, no external dependency or third-party QR service) with backup codes. Customers have no 2FA. **No OAuth** (Google/Apple/Facebook) exists anywhere, despite the blueprint asking for it — this needs developer-app configuration and allowed-redirect-URL setup the owner hasn't done, so it's correctly absent rather than half-built.

## 2. Authorization — verified this session

Every account-scoped route calls `requireCustomer()` (`src/lib/server/customerContext.ts`), which resolves `customerId` **only** from the verified session cookie, never from client input, and every store function downstream takes that `customerId` as a mandatory filter. This session ran a live test suite against the real (test-data) database: a second customer attempting to read, modify, delete, cancel, pay, or reschedule the first customer's requests/quotes/bookings/attachments was blocked (404, not data-shaped differently) in **13 of 13** attempts, and the target customer's data was confirmed unchanged afterward. Unauthenticated requests to the same 5 endpoint families were blocked (401) in all cases tested. A customer session cookie was also confirmed unable to call the admin `client-thread` endpoints (401) — the two authorization systems don't leak into each other.

Admin routes follow the same `requireAdmin(req, permission)` pattern per-route, and additionally, as of 2026-09-21, are backstopped by `src/proxy.ts` (Next's "Proxy," formerly `middleware.ts` — see D-8 in `docs/DECISIONS.md`): every request under `/admin/*` and `/api/admin/*` is checked for a validly signed, unexpired admin session token *before* it reaches route code, independent of whether that route remembered to call `requireAdmin()` itself. This closes the "a future route forgets the check" failure mode down to "logged out," not "wide open." It does **not** check fine-grained permissions (`MANAGE_LEADS` etc.) — that stays in each route's own `requireAdmin(req, permission)` call, which also does the DB lookup the proxy deliberately skips to stay fast. Verified live this session: 6 admin API routes and the admin dashboard page were confirmed blocked with no cookie (401 for APIs, redirect-to-login for pages), a forged/garbage cookie was rejected cleanly (no 500), the public admin-auth endpoints (login, 2FA verify, forgot/reset-password, logout) remained reachable, and a real admin login + authenticated request + page load all still worked end-to-end through the proxy. 17/17 checks passed.

## 3. Cross-site request protection

Customer mutations check the `Origin` header against `Host` (`isSameOrigin()`) and reject a mismatch with 403 — verified live this session (a request with a valid session cookie but `Origin: https://evil.example.com` was rejected). This is not full CSRF-token protection, but combined with `SameSite=Lax` cookies (which already stop cross-site form-POST cookie attachment in modern browsers) it's a reasonable layered defense for this app's risk level. **Not verified for admin routes** — same gap as §2.

## 4. Input validation and injection

All API input is validated with `zod` schemas before touching the database; all database access goes through Prisma (parameterized queries — no raw SQL string concatenation exists in application code; the only raw SQL in the repo is the hand-reviewed migration-application scripts run manually by an operator, never at request time). No SQL injection surface was found.

## 5. Uploads — verified this session

- **Type is checked by magic bytes** (`sniffMedia()` reads the first bytes of the file), not the browser-supplied `Content-Type` or filename extension. A file with a `.jpg` name and `image/jpeg` MIME type but a fake (non-image) byte payload was rejected; an SVG (a real XSS vector if served as a document) was rejected outright — this app doesn't accept SVG uploads at all.
- Images are re-encoded through `sharp` (rotate, resize, strip metadata) before storage — a JPEG with a `Copyright` EXIF marker was confirmed to have zero trace of it in the stored file.
- Stored filenames are 128-bit random hex, not derived from the original name or any user input — no path traversal is possible from the filename itself, and a literal `../../` path-traversal attempt against the local-fallback serving route (`/api/uploads/client/[file]`) was rejected (404) by that route's strict filename-pattern check.
- Local-fallback uploads are served through a dedicated route rather than Next's static file handling, because **Next does not serve files written to `public/` after build time** on a production server — this was a real bug found and fixed this session (uploaded photos rendered as broken images in production mode until the dedicated route was added).
- **Access control on uploaded files is "unguessable URL," not "authenticated + authorized."** Anyone who obtains a photo/video URL (e.g. it leaks in a referrer header, a screenshot, a forwarded email) can view it without being logged in as that customer. This matches the blueprint's own object-storage pattern loosely but is weaker than a signed, expiring URL. Acceptable for now given the random-URL entropy and that nothing more sensitive than cleaning-job photos flows through this path — worth tightening if the data sensitivity bar rises (e.g. if ID documents or financial info ever flow through the same pipeline).

## 6. Rate limiting

In-memory, per-process, per-IP sliding window. Explicitly documented in the code (`rateLimit.ts`'s own comment) as not durable across multiple serverless instances — under real multi-instance Vercel traffic, an attacker distributed across instances effectively gets a higher limit than configured. Applied to: the public quote form (5/10min), booking-slot lookups (60/10min), and — added when the photo-estimate feature was built — a much tighter limit on that endpoint specifically because each call can cost real money (a paid vision-model call). **Recommendation**: move to a durable store (Upstash Redis or similar) before/if real attack traffic or cost-abuse risk becomes a concern; the `checkRateLimit()` call signature was deliberately kept swap-compatible with this in mind.

## 7. Secrets

Integration credentials (`integrationSettings.ts`) are stored as plain JSON in `BusinessSetting` (protected by DB access control + TLS-in-transit only, **not** application-level encrypted) — this is a documented, deliberate tradeoff for a small-business admin-settings UX, not an oversight, and the code comment says so explicitly. Session-signing secrets and the database URL live in environment variables (Vercel encrypted env vars in production), never in the repo. `.env.local`/`.env.example` are correctly gitignored/placeholder-only — confirmed no real secret value is committed anywhere in the repo history touched by this session.

## 7a. Error monitoring (added 2026-09-21)

`@sentry/nextjs` is now installed and wired (`src/instrumentation.ts`, `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`'s `withSentryConfig` wrapper) — but **no DSN has been entered**, so it is currently a correctly-configured no-op (verified: production build and server start both succeed cleanly with zero Sentry-related errors or warnings, and Sentry's own SDK contract guarantees a DSN-less `init()` sends nothing). Setting `NEXT_PUBLIC_SENTRY_DSN` (a redeploy, not a `/admin/settings` value — see `docs/INTEGRATIONS.md` for why this integration can't be hot-swapped the way the others are) is the only step left to get real error visibility. See §5 of `docs/OPERATIONS.md`, updated to reflect this.

## 8. What a professional review still needs to cover (not claimed done here)

Per blueprint §7 — none of the following has had outside legal/compliance review, and this document makes no claim that they're compliant:
- Washington business licensing and subcontractor classification (moot until the workforce module exists, but relevant before it's built).
- SMS/email consent language and retention (TCPA/CAN-SPAM-adjacent) — the mechanism (opt-in checkboxes, stored consent, honored before marketing-adjacent sends) exists; the *wording* shown to customers has not been reviewed by counsel.
- Photo/video retention policy — files are kept indefinitely today; no automatic deletion window exists.
- PCI scope — mitigated by using Stripe Checkout (hosted page, no card data ever touches this app's servers), which is the right architecture choice, but this has not been formally assessed.
