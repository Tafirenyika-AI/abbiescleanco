# Telnyx 10DLC Customer Care campaign setup

This is the owner-only setup needed to actually turn on live SMS. The code side (provider
abstraction, consent capture/storage, inbound webhook with STOP/START/HELP handling, deterministic
templates, admin compliance checklist) is built and ready -- what's left is real Telnyx credentials
and the campaign's own external approval, neither of which this code can do on its own.

## What was registered (for the team's reference)

**Brand:** Abbie's Clean Method LLC

**Use case:** Customer Care

**Campaign description** (use this exact text if Telnyx asks you to re-confirm or re-submit it):

> Abbie's Clean Method LLC uses this campaign to provide customer care and transactional SMS
> communications to customers who have opted in to receive text messages. Messages may include
> cleaning appointment confirmations and reminders, scheduling and rescheduling updates,
> service-related updates, quote follow-ups, payment or invoice notifications, and responses to
> customer service inquiries. Messages are only sent to customers who have provided consent or
> initiated an SMS conversation with Abbie's Clean Method LLC.

**Opt-in keywords:** START, YES
**Opt-out keywords:** STOP, UNSUBSCRIBE
**Help keyword:** HELP

**Campaign attributes:**
- Embedded Link: No
- Embedded Phone Number: No
- Number Pooling: No
- Age-Gated Content: No
- Direct Lending/Loan: No

**⚠️ Before submitting**: if any real outbound message will ever contain a URL (the live-tracking
link template already does -- see `src/lib/server/trackingStore.ts`'s `createLocationShare`, though
that one texts the *cleaner*, not a customer) or a phone number beyond the standard support contact,
flag this to Telnyx explicitly -- "Embedded Link: No" above may need to change to match real traffic,
and campaigns are commonly rejected for understating this.

**Privacy Policy:** `https://abbiescleanco.com/policies/privacy` (or your actual
`NEXT_PUBLIC_SITE_URL` domain if one is set in Vercel -- see below)
**Terms & Conditions:** `https://abbiescleanco.com/policies/terms`

## 1. Get your Telnyx credentials

From [portal.telnyx.com](https://portal.telnyx.com):

1. **API Key** -- Account -> API Keys. This is a secret; never commit it or paste it anywhere but
   Settings -> Integrations below.
2. **Messaging Profile ID** -- Messaging -> Messaging Profiles -- create or use the one tied to
   your approved 10DLC campaign. Starts with a UUID, not a prefix like Twilio's `MG...`.
3. **Public Key** -- Account -> Public Key (used to verify webhook signatures). This one genuinely
   is public, safe to store/display anywhere.
4. Confirm a real phone number is assigned to that Messaging Profile (Numbers -> your number ->
   Messaging Profile). Campaign approval alone doesn't guarantee a number is attached.

## 2. Fill in Settings -> Integrations on the live site

Four fields, all server-side only (never exposed to the browser):
- **Telnyx API Key**
- **Telnyx Messaging Profile ID**
- **Telnyx Public Key**
- **SMS provider**: `telnyx` (this is also the default if left blank)

Leave "Telnyx From Number" blank -- the Messaging Profile ID takes priority and is Telnyx's
recommended way to send under an approved 10DLC campaign.

## 3. Configure the webhook in Telnyx

In the same Messaging Profile, set the **Inbound Settings webhook URL** to:

```
https://abbiescleanco.com/api/webhooks/telnyx/messages
```

(Use your real `NEXT_PUBLIC_SITE_URL` value instead if one is set in Vercel -- never the
`*.vercel.app` preview URL; see `src/lib/server/siteUrl.ts`.) Also enable delivery-status
("message.sent" / "message.finalized") webhooks on the same URL -- the route handles both inbound
messages and delivery receipts, distinguishing by `event_type`.

The route verifies Telnyx's Ed25519 signature (`telnyx-signature-ed25519` +
`telnyx-timestamp` headers) against the Public Key above before processing anything, and is
idempotent (a `webhook_events` table dedupes by Telnyx's own event id, so a redelivered event is a
safe no-op). **The exact signing scheme here was implemented from Telnyx's documented Node.js
pattern as of this writing but hasn't been exercised against a real Telnyx webhook delivery yet
(no credentials were available while building this) -- re-verify against Telnyx's current webhook
docs and test with a real delivery before relying on it.**

## 4. Set `SMS_ENABLED` in Vercel -- production only

Nothing sends for real anywhere (local dev, automated tests, Vercel preview deployments, or even
production) until a Vercel environment variable:

```
SMS_ENABLED=true
```

is set **on the Production environment specifically**. Until then every send is logged
(`[mock sms] ...`) instead of actually calling Telnyx -- this is deliberate and is what keeps
preview deployments and local development from ever texting a real customer. Do not set this on
Preview or Development environments in Vercel.

## 5. Verify

- **Admin -> Settings -> Integrations**: "Send Test SMS" becomes available once the fields above
  are filled in -- send one to your own phone.
- **Admin -> Settings**, further down: the "Telnyx 10DLC readiness" checklist shows what's real vs.
  still missing. The last two items (campaign approved, number assigned) are always shown as
  requiring manual confirmation in the Telnyx portal -- this app can't verify Telnyx's own approval
  state, and deliberately never claims to.
- **Admin -> SMS log** (`/admin/sms`): every outbound and inbound message, with delivery status.

## Architecture notes for future work

- `src/lib/server/sms/` is the whole SMS subsystem: `types.ts` (the `SMSProvider` interface),
  `telnyxProvider.ts` / `twilioProvider.ts` / `mockProvider.ts` (swap via the `smsProvider` setting
  or `SMS_PROVIDER` env var -- no other code needs to change), `provider.ts` (the `SMS_ENABLED`
  safety gate), `consent.ts` (the append-only `SmsConsentEvent` audit trail +
  `CommunicationPreference.smsConsent`/`smsMarketingConsent` current-state flags, kept
  deliberately separate), `templates.ts` (deterministic, no AI), `send.ts`
  (`sendCustomerSms()` -- the ONE function anything in this app should call to send an SMS; nothing
  else should import a provider directly).
- Real AI-assisted replies to ordinary (non-keyword) inbound messages are intentionally **not**
  wired up yet -- `src/app/api/webhooks/telnyx/messages/route.ts`'s `handleInbound()` currently
  sends a deterministic "we'll get back to you" acknowledgment and notifies an admin
  (`notifyAdmins(..., "/admin/sms")`). When ready to automate this, keep the AI layer narrow and
  tool-based (`get_customer_booking()`, `get_next_appointment()`, `request_reschedule_options()`,
  `get_invoice_status()`, `create_support_case()`) rather than giving it open database access, and
  keep STOP/START/HELP exactly as deterministic as they are now -- never route those three through
  an LLM.
