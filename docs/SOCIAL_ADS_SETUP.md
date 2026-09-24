# Connecting real social + ad accounts for automated publishing

This is the owner-only setup needed before Marketing Studio can post to Facebook/Instagram
automatically, run Google Ads, or post to TikTok. The code side (OAuth connect flow, credential
storage, real publish calls) is built and live-verified — what's missing is the developer app on
each platform, which only the business owner can create (it's tied to your real business
identity, not something this code can do on its own).

**Before starting any of these**, confirm `NEXT_PUBLIC_SITE_URL` is set to
`https://abbiescleanco.vercel.app` in the Vercel project's environment variables (Project →
Settings → Environment Variables). Every redirect URI below is built from that value — if it's
unset or wrong, the OAuth dialog will send Meta/Google/TikTok back to the wrong address and the
connection will fail at the last step. (This app's live URL is intentionally the `.vercel.app`
one, not `abbiescleanco.com` — see `docs/DECISIONS.md`.)

For each platform: create the app, then paste its ID/secret into **Admin → Settings →
Integrations**, then click the matching **Connect** button on **Admin → Marketing studio →
Connected accounts**.

---

## 1. Meta (Facebook Page + Instagram Business account)

You need to already have: a real Facebook Page for the business, and (optionally) an Instagram
Business or Creator account linked to that Page.

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps** → **Create App**.
2. App type: **Business**. Name it something like "Abbie's Clean Method Marketing".
3. In the app dashboard, add the **Facebook Login** product (Settings → Client OAuth Settings).
4. Under **Valid OAuth Redirect URIs**, add exactly:
   `https://abbiescleanco.vercel.app/api/admin/marketing/connections/meta/callback`
5. Add the **Instagram Graph API** product too (needed for Instagram posting, not just Facebook).
6. Go to **App Settings → Basic** and copy the **App ID** and **App Secret**.
7. Paste those into Admin → Settings → Integrations as **Meta App ID** / **Meta App Secret**.
8. On Marketing Studio → Connected accounts, click **Connect Facebook + Instagram**, log in with
   the Facebook account that admins your business Page, and approve the permissions.
9. **Important — app mode**: while the app is in Development mode, only Facebook accounts added
   as "testers/admins" on the app (developers.facebook.com → your app → Roles) can complete the
   OAuth flow. Since this only ever connects your own Page, you do **not** need Meta's full
   public App Review process — just make sure the Facebook account you're connecting with is
   listed as an admin/tester of the app itself. If you eventually want other people's pages to
   connect too, that's when App Review becomes required; not needed for your own use.

What this unlocks once connected: **Publish now** on an approved Marketing Studio post calls the
real Facebook Graph API (`/feed` or `/photos`) and, for Instagram, the real two-step media
publish flow — both already built and tested against Facebook's real API (a fake token was
correctly rejected with a real "Invalid OAuth access token" error during testing, proving the
failure path is honest, not silently faked).

## 2. Google Ads

You need: a real Google Ads account (or a Google Ads **Manager/MCC** account if you'll manage it
through one), and patience — the developer token step below has a real approval wait.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) → create a new project (or
   reuse one).
2. **APIs & Services → OAuth consent screen** → set it up (External, add your business info).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type
   **Web application**.
4. Under **Authorized redirect URIs**, add exactly:
   `https://abbiescleanco.vercel.app/api/admin/marketing/connections/google-ads/callback`
5. Copy the **Client ID** and **Client Secret** → paste into Settings → Integrations as **Google
   Ads OAuth Client ID / Secret**.
6. Go to [ads.google.com](https://ads.google.com/) → sign in → **Tools & Settings → Setup → API
   Center**. Apply for a developer token.
   - A **test-account-only** token is usually granted quickly (sometimes instantly) — good enough
     to connect and verify the pipeline works.
   - **Basic Access** (needed to manage a real, live account with real spend) requires Google's
     manual review and can take several business days. Don't expect this step to be instant.
7. Paste the developer token into Settings → Integrations as **Google Ads Developer Token**.
8. If you're connecting through a Manager (MCC) account rather than a standalone Ads account, also
   set **Google Ads Manager (MCC) Customer ID** (the 10-digit id, no dashes).
9. On Marketing Studio → Connected accounts, click **Connect Google Ads** and approve access.

What this unlocks once connected: a real, live OAuth connection (proven by successfully listing
your accessible Ads accounts through Google's own API). **Actually creating/running ad campaigns
is a separate next step, not built yet** — the connection itself is real and useful (it proves
the app + developer token work), but campaign creation (budgets, ad groups, ads, targeting) is
its own significant slice of the Ads API that needs a live, working connection to build against
safely. Tell me once this step is connected and I'll build campaign creation next.

## 3. TikTok

You need: a TikTok Business account.

1. Go to [developers.tiktok.com](https://developers.tiktok.com/) → sign in with a TikTok Business
   account → **Manage apps → Create an app**.
2. Add the **Login Kit** and **Content Posting API** products.
3. Under redirect URI, add exactly:
   `https://abbiescleanco.vercel.app/api/admin/marketing/connections/tiktok/callback`
4. Request the scopes `user.info.basic`, `video.publish`, `video.upload`.
   - `video.publish` (direct posting to the account's public feed) is an **audited scope** —
     TikTok reviews and approves it separately, and approval isn't instant or guaranteed on a
     first submission. Until it's approved, the connection itself still works, but the platform
     will reject actual publish attempts.
5. Copy the **Client Key** and **Client Secret** → paste into Settings → Integrations as **TikTok
   Client Key / Secret**.
6. On Marketing Studio → Connected accounts, click **Connect TikTok** and approve access.

What this unlocks once connected: a real, live OAuth connection with your TikTok account (access
+ refresh token stored, account name shown in Connected accounts). **Actual video publishing
through the Content Posting API is a separate next step, not built yet** — same reasoning as
Google Ads: better to build it against a real, working connection than write it blind.

---

## What's already fully built vs. what's next

| Platform | Connect (OAuth) | Automated publish |
|---|---|---|
| Facebook Page | **Built + tested against the real Graph API** | **Built** — "Publish now" on an approved post calls Facebook's real `/feed` or `/photos` endpoint |
| Instagram Business | **Built + tested against the real Graph API** | **Built** — real two-step media create + publish call (requires an image on the post) |
| Google Ads | **Built** (real OAuth + real account listing) | Not built yet — campaign creation is a separate, larger piece of the Ads API, next once you're connected |
| TikTok | **Built** (real OAuth) | Not built yet — pending your `video.publish` scope approval from TikTok |

A post with no connected account attached still works exactly as before: draft → approve → you
publish it yourself on the real platform → **Mark posted**. Nothing about automated publishing
removes that manual fallback.

---

## 4. AI-generated posters/flyers + promo videos

Separate from the OAuth setup above — this generates the actual **content** (the image/video
attached to a post), not the publishing connection.

- **Posters/flyers**: paste an **OpenAI API key** (from [platform.openai.com](https://platform.openai.com/)) into Settings → Integrations. In the post draft form, switch the image picker to
  "Generate with AI", describe what the poster should show (e.g. "Fall deep-clean special, 20%
  off, sparkling kitchen, bold offer text"), pick a size, and click **Generate poster**. This
  calls OpenAI's `gpt-image-1` model with your description plus the business's real name/city
  automatically added for context — it never invents a promotion or price you didn't type. Billed
  per image by OpenAI (no separate app/developer-account step needed, just the key).
- **Promo videos**: no new account needed at all. In the same form, add 1-4 images to the "AI
  promo video" panel (your post's poster and/or extra uploads), add optional overlay text, and
  click **Generate video**. This renders a real pan/zoom slideshow with your text overlaid
  entirely in your own browser (no server-side video encoding, no extra cost) and produces a real
  short `.webm` video file. **This is not "true" AI-generated video** (no model is inventing
  footage) — it's real automated video assembly from real images, the same technique most social
  schedulers use for "turn these photos into a video ad." **Automated publishing doesn't post
  video yet** (Meta's publish code only handles images today) — download the generated video or
  attach it manually wherever you publish it; a future step could wire it into Reels/TikTok
  publishing once that's worth building.
