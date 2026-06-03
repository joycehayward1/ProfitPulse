# Developer Handoff Notes

Quick orientation for anyone picking up ProfitPulse after the May 2026 launch.

**Start here:** [PRODUCT_REFERENCE_GUIDE.md](./PRODUCT_REFERENCE_GUIDE.md) — platforms, accounts, pricing, QuickBooks, deployment, and roadmap.

---

## Production vs GitHub

- **Live site:** [https://myprofitpulse.app](https://myprofitpulse.app)
- **Production branch:** `main` (Vercel Production deploys from here)
- **Integration branch:** `staging` (pre-prod testing; keep in sync with `main` after releases)

After May 2026, the repo was synced to match what was deployed to Vercel production (launch pricing, payment fixes, and handoff docs).

---

## Who has what

| System | Notes |
|--------|-------|
| **Vercel** | Team `profit-pulse2`, project `profit-pulse` — all production env vars |
| **GitHub** | [github.com/joycehayward1/ProfitPulse](https://github.com/joycehayward1/ProfitPulse) |
| **InsForge** | Postgres + auth + AI gateway — credentials in Vercel only |
| **Authorize.net** | Live merchant account (Fusion 4 Business, Bermuda) |
| **Intuit** | QuickBooks OAuth app — production redirect URI on `myprofitpulse.app` |
| **Resend** | Sending domain `contact.myprofitpulse.app` |

Never commit secrets. Use Vercel → Environment Variables for Production.

---

## Pricing paths (live)

| Path | URL | Price |
|------|-----|-------|
| Standard (7-day trial) | `/signup` → `/pricing` | $59.99/mo or $599.88/yr |
| Launch offer (locked discount) | `/launch` | $47.99/mo or $419.92/yr |

Launch subscribers have `pricing_promo: launch` on their `subscriptions` row; ARB renewals use the discounted amount.

---

## Known operational notes

1. **Refunds** — Process in the Authorize.net merchant dashboard (Transaction Search). In-app cancel stops renewals but does not refund.
2. **Test subscriptions** — Any accounts created during `$1` live validation may still have $1 ARB in Authorize.net. Cancel in app + ANet dashboard before treating as real customers.
3. **Switch to annual** — Charges vaulted card first, then cancels monthly ARB, then creates annual ARB. Authorize.net `invoiceNumber` max length is 20 characters.
4. **QuickBooks** — OAuth tokens encrypted with `TOKEN_ENCRYPTION_KEY`. Rotating that key invalidates existing connections.
5. **AI** — ChatGPT `openai/gpt-4o-mini` via InsForge AI gateway (`src/lib/ai-insights.ts`).
6. **Email** — Product email from `hello@contact.myprofitpulse.app` via Resend; auth email from InsForge.

---

## Migrations

Run pending SQL in InsForge before deploying code that depends on new columns:

- `src/lib/migrations/002_launch_pricing_promo.sql` — adds `pricing_promo` to `subscriptions`

---

## Deploy checklist (routine release)

1. Merge PR to `main`
2. Confirm Vercel Production build succeeds
3. If env vars changed (especially `NEXT_PUBLIC_*`), trigger redeploy
4. Smoke-test: signup, `/launch` checkout, billing cancel

Full cutover reference: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) (QuickBooks is out of scope — see [quickbooks-integration.md](./quickbooks-integration.md) when enabling)

---

## Roadmap

Product direction for v2+ is in [ROADMAP.md](../ROADMAP.md) at the repo root.
