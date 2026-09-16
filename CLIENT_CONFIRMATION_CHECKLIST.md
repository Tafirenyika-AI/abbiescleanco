# Client Confirmation Checklist

Everything below needs Abbie's Clean Method's explicit sign-off before
launch. Nothing here was invented as fact — each item is either carried
over from the current live site (flagged where it conflicts with something
else) or left as a placeholder pending your answer.

## 1. Pricing

The current site (abbiescleanco.com/packages) publishes these ranges, which
this rebuild used as the estimator's pricing engine (`src/lib/pricing.ts`):

- Standard Cleaning: $150–$200 (2–3 hrs)
- Deep Cleaning: $225–$450 (3–6 hrs)
- Move-Out Cleaning: $300+ (3–6 hrs)
- Add-ons: inside oven $25–$50, inside fridge $25–$40, pet hair $25+,
  laundry $20+, dishes $15–$30, interior windows $50+, extra attention $25+

**Please confirm these are still accurate.** The estimator scales them by
bedrooms/bathrooms/square footage/condition to produce a range — the exact
scaling formula is a reasonable starting point, not something you've
approved line by line. Recommend a short call to sanity-check a few sample
estimates against what you'd actually quote.

**Recurring-service discounts are OFF.** The spec says not to show savings
language unless you approve specific rates — none are shown anywhere on the
site right now. If you want to offer a discount for weekly/biweekly/monthly
service, tell us the percentage and we'll enable it (`recurringDiscountsEnabled`
in `src/lib/pricing.ts`).

## 2. Image/pricing conflict — needs a decision

Several images carried over from the current site's media library have a
"From $XX" price badge baked directly into the photo (e.g., "From $220" on
the Standard Cleaning card, "From $280" on Move-In/Move-Out). **These numbers
don't match the real pricing above** and were probably placeholder/template
content from whatever theme the current site started from, not numbers you
set. Right now they're still visible on the Services page. Options:

1. Replace those specific images with real, unbadged photos (recommended).
2. Keep them if you're fine with visitors briefly seeing a different number
   than the real quote — not recommended, but your call.
3. Send new photography and we'll swap them in.

## 3. Claims removed from the current site — need confirmation to re-add

The current site states:

- **"Licensed and insured professionals"** — removed from this rebuild. Per
  the project brief, this can't be published unless you confirm it's
  accurate (and ideally, that you can back it up if asked).
- **"450+ Homes Cleaned," "98% Satisfaction Rate," "3+ Years of Service"** —
  removed. Same reason: these read as verifiable claims, and no source for
  them was provided. If they're accurate, give the real numbers (or "as of
  [date]" framing) and we'll add them back as a trust-indicator section.

## 4. Genuine vs. stock photography

Only **4 images** from the current site's media library are genuine company
photos: the logo, two real home interior photos, and one real photo of
Abigail. The rest of what's currently live (kitchen/bathroom/closet photos
with price badges, a German public-restroom stock photo, two generic stock
headshot avatars used next to the Jackie Roman / Ivan Rojas Morales
testimonials) are stock/template images, not your actual work. Per your
instruction, they're still in use in this build as general section imagery
— but for a "premium, not-generic-template" feel long-term, and to avoid
implying stock photos are real before/after work, we'd recommend replacing
them with your own photography as you take it. The gallery page is built to
make swapping images easy.

## 5. Facebook link

Pulled from the current site's footer: `facebook.com/share/r/1DSvyHGEy8/?mibextid=wwXIfr`.
This is a Facebook **post/reel share link**, not a stable Page URL — it may
stop working or isn't what you want linked from the footer. Please confirm
the correct permanent Facebook Page URL (or confirm this one is fine).

## 6. Policy pages — placeholder numbers

All 5 policy pages (`/policies/*`) are marked as drafts on the page itself.
Specific numbers left as placeholders pending your decision:

- **Cancellation & Rescheduling:** how much advance notice is required for a
  free reschedule/cancellation (e.g., 24h, 48h)? Is there a late-cancel or
  no-show fee, and how much?
- **Satisfaction & Re-clean:** how many days after a visit can a customer
  request a re-clean? Is it free, and under what conditions?
- **Terms of Service:** payment methods/timing, and a liability-limitation
  clause — this section in particular should get a lawyer's eyes before
  publishing, not just yours.

## 7. Admin access

The admin dashboard (`/admin`) currently uses one shared demo login
(`ADMIN_DEMO_EMAIL` / `ADMIN_DEMO_PASSWORD` env vars) — fine for internal
testing, not for real staff access. Before anyone besides you uses it,
this needs real per-person accounts (the `admin_users` table already
supports this; it just needs a signup/invite flow built).

## 8. Service area precision

The site lists Spokane Valley, Spokane, Liberty Lake, Millwood, Veradale,
Greenacres, and Opportunity as served areas (`src/lib/data/business.ts`).
Confirm this list, and let us know if you want real ZIP-code-level
validation in the estimator (requires a Google Maps API key — see
`.env.example`) instead of free-text ZIP entry.

## 9. Third-party accounts needed for full Phase 3/4 functionality

None of these are required for the site to work today — only for the
features tied to them:

- **Resend** account + verified sending domain (email deliverability)
- **Twilio** (or WhatsApp Business API) account (SMS/WhatsApp automation)
- **Stripe** account (deposits/payments — Phase 4)
- **Google Cloud** project with Maps + Calendar APIs enabled (Phase 3/4)
- **Cloudflare Turnstile** site (extra bot protection beyond the honeypot +
  rate limiting already in place)
- **Sentry** project (production error monitoring)
- **Google Business Profile** API access, if/when you want real Google
  reviews pulled into the Reviews page (must use the official API — no
  scraping)

## 10. Google Business reviews

Only the two reviews already on your site (Jackie Roman, Ivan Rojas
Morales) are shown. If you want live Google reviews integrated later, that
requires the official Google Business Profile API (see item 9) — flag when
you're ready and we'll wire it in.
