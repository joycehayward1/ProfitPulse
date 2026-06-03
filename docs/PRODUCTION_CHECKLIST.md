# Production Cutover Checklist

Single source of truth for everything that needs to change when ProfitPulse
moves from sandbox/preview to production. Walk this top-to-bottom on launch
day — nothing here is optional.

**Out of scope for this checklist:** QuickBooks / Intuit. The integration is
not part of the current production launch. When you enable it later, use
`docs/quickbooks-integration.md` instead.

Each item has its source file or external system noted so you can jump
straight to where the change lives.

---

## 1. Domain & App URLs

- [ ] Point production domain at Vercel (A/CNAME records)
- [ ] Add domain in Vercel → Settings → Domains
- [ ] `NEXT_PUBLIC_APP_URL` → `https://<production-domain>` (Vercel env, Production scope)
- [ ] Verify email/password reset links resolve to production domain (handled automatically by `NEXT_PUBLIC_APP_URL`)

## 2. Authorize.net — Credentials

Log in to the **live** merchant account at https://account.authorize.net/
(NOT sandbox). Go to Account → Settings → API Credentials & Keys to
generate production keys.

- [ ] `ANET_API_LOGIN_ID` → live value (Vercel, Production)
- [ ] `ANET_TRANSACTION_KEY` → live value (Vercel, Production)
- [ ] `ANET_SIGNATURE_KEY` → live value (Vercel, Production)
- [ ] `NEXT_PUBLIC_ANET_API_LOGIN_ID` → live value (Vercel, Production)
- [ ] `NEXT_PUBLIC_ANET_CLIENT_KEY` → live value (Vercel, Production)
- [ ] `NEXT_PUBLIC_ANET_ENVIRONMENT` → `PRODUCTION` (Vercel, Production)

The app code auto-switches API endpoints based on `NEXT_PUBLIC_ANET_ENVIRONMENT`:
- Sandbox: `https://apitest.authorize.net/xml/v1/request.api`
- Production: `https://api.authorize.net/xml/v1/request.api`

And `react-acceptjs` auto-switches the script tag:
- Sandbox: `https://jstest.authorize.net/v1/Accept.js`
- Production: `https://js.authorize.net/v1/Accept.js`

## 3. Authorize.net — Webhooks

Webhook registration is **per-merchant-account**, so your sandbox webhook
does not carry over. You must re-register on the live account.

- [ ] In live dashboard: Account → Settings → Business Settings → Webhooks
- [ ] Add endpoint: `https://<production-domain>/api/webhooks/authorize-net`
- [ ] Status: Active
- [ ] Subscribe to events:
  - [ ] `net.authorize.payment.authcapture.created`
  - [ ] `net.authorize.customer.subscription.created`
  - [ ] `net.authorize.customer.subscription.suspended`
  - [ ] `net.authorize.customer.subscription.terminated`
  - [ ] `net.authorize.customer.subscription.cancelled`
- [ ] Verify webhook HMAC uses `ANET_SIGNATURE_KEY` (from Security Settings → API
  Credentials & Keys → Signature Key). Authorize.net does **not** have per-endpoint
  webhook keys — it uses the same API Signature Key for all webhook HMAC verification.

## 4. Authorize.net — Smoke test

Before announcing launch:

- [ ] Run one real signup → subscribe flow with a real card
- [ ] Verify customer received email receipt
- [ ] Verify webhook fired (check Vercel function logs)
- [ ] Verify `subscriptions` row updated in InsForge
- [ ] Verify `payment_records` row inserted in InsForge
- [ ] **Refund the test transaction immediately** (via Authorize.net dashboard)
- [ ] Cancel the test ARB subscription

## 5. InsForge

- [ ] Confirm production InsForge project is provisioned (or reuse staging)
- [ ] `NEXT_PUBLIC_INSFORGE_URL` → production URL
- [ ] `NEXT_PUBLIC_INSFORGE_ANON_KEY` → production anon key
- [ ] `INSFORGE_API_KEY` → production API key
- [ ] Run `src/lib/schema.sql` against production database
- [ ] Run any pending migrations in `src/lib/migrations/`
- [ ] Verify RLS policies are enabled

## 6. Email (Resend)

- [ ] Verify sending domain (e.g. `contact.myprofitpulse.app`) in Resend dashboard
- [ ] Add SPF, DKIM, DMARC DNS records
- [ ] `RESEND_API_KEY` → production key (Vercel, Production)
- [ ] Update `FROM_EMAIL` in `src/lib/resend.ts` if domain changes
- [ ] Send a test weekly summary + notification to verify deliverability

## 7. Secrets rotation

Anything that was ever committed, shared, or used in development should be
rotated before launch:

- [ ] `INSFORGE_API_KEY` → new production key if the dev key was ever exposed
- [ ] `RESEND_API_KEY` → new production key if the dev key was ever exposed
- [ ] Authorize.net transaction key → regenerate in live merchant dashboard if exposed

## 8. Environment variable audit

Go to Vercel → Settings → Environment Variables and verify **every** var
below has a Production-scoped value and it is NOT pointing at sandbox:

| Variable | Expected production value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<production-domain>` |
| `NEXT_PUBLIC_INSFORGE_URL` | Production InsForge URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Production anon key |
| `INSFORGE_API_KEY` | Production API key |
| `RESEND_API_KEY` | Production Resend |
| `ANET_API_LOGIN_ID` | Live merchant |
| `ANET_TRANSACTION_KEY` | Live merchant |
| `ANET_SIGNATURE_KEY` | Live merchant (also used for webhook HMAC) |
| `NEXT_PUBLIC_ANET_API_LOGIN_ID` | Live merchant |
| `NEXT_PUBLIC_ANET_CLIENT_KEY` | Live merchant |
| `NEXT_PUBLIC_ANET_ENVIRONMENT` | `PRODUCTION` |

## 9. Code audit

- [ ] No `console.log` of sensitive data (card fields, tokens, raw webhooks)
- [ ] No `TODO` or `XXX` comments blocking launch (grep the repo)
- [ ] No hardcoded sandbox URLs anywhere (grep for `sandbox.authorize.net`, `apitest.authorize.net`, `jstest.authorize.net`)
- [ ] No hardcoded localhost URLs
- [ ] Error boundaries in place on payment flow pages

## 10. Legal / UX

- [ ] Terms of Service URL live and linked from signup
- [ ] Privacy Policy URL live and linked from signup
- [ ] Refund / cancellation policy documented in settings page
- [ ] Billing contact email answered by a real person

## 11. Monitoring

- [ ] Vercel function logs accessible
- [ ] Error tracking wired up (Sentry or similar) — optional but recommended
- [ ] Alert on 5xx rate from `/api/payments/*` routes
- [ ] Daily check of failed `payment_records`

---

## When in doubt

If you find yourself uncertain whether a change needs to happen, ask: "Is
this still pointing at sandbox, test data, or localhost?" If yes, fix it.

Last updated: 2026-05-26
