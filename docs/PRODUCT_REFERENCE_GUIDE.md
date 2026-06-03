# ProfitPulse Product Reference Guide

**Owner:** Fusion 4 Business (Joyce Hayward)  
**Product:** ProfitPulse — CEO financial clarity dashboard for service-based business owners  
**Live URL:** [https://myprofitpulse.app](https://myprofitpulse.app)  
**Last updated:** May 2026 (post-launch)

This document is the single reference for what was built, which platforms power it, how to operate it, and where the product is headed next.

---

## 1. What ProfitPulse Is

ProfitPulse turns financial data (QuickBooks, spreadsheets, or manual entry) into a dashboard that answers three questions:

1. **Am I making money?**
2. **Do I have enough cash?**
3. **What should I do next?**

Core capabilities shipped in v1:

| Area | What users get |
|------|----------------|
| **Health Assessment** | 1–100 score + AI summary from questions or spreadsheet upload |
| **Dashboard** | Cash, runway, burn, revenue — traffic-light health signals |
| **Scenario calculators** | Break-even, goal planning, hiring, cash runway |
| **Reports** | P&L, cash flow, balance sheet |
| **Data entry** | Manual forms, CSV/Excel upload (AI extraction), QuickBooks sync |
| **Billing** | Pro subscription via Authorize.net (trial + paid paths) |
| **Launch offer** | Discounted “launch pricing” path locked in forever for early buyers |
| **Admin** | User stats, trial extension, Pro grants (operator-only) |
| **Legal** | Terms + EULA (QuickBooks-ready) and Privacy Policy |

---

## 2. Platform Stack (Everything That Powers the App)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                    │
│  myprofitpulse.app (Next.js 14, React, Tailwind CSS 3.4)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────────┐   ┌──────────────────┐
│   VERCEL    │    │    INSFORGE     │   │  AUTHORIZE.NET   │
│  Hosting +  │    │  Postgres DB    │   │  Payments +    │
│  Cron jobs  │    │  Auth + AI GW   │   │  ARB recurring │
└─────────────┘    └────────┬────────┘   └──────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  INTUIT  │  │  RESEND  │  │  ChatGPT  │
       │ QuickBooks│  │ contact.*│  │ (via IF) │
       └──────────┘  └──────────┘  └──────────┘
```

### Platform reference

| Platform | Role | Where to manage |
|----------|------|-----------------|
| **Vercel** | Production hosting, serverless API routes, cron jobs | [vercel.com](https://vercel.com) — team **profit-pulse2**, project **profit-pulse** |
| **InsForge** | Database (PostgreSQL + RLS), authentication, AI chat gateway, storage | InsForge dashboard — project URL in Vercel env `NEXT_PUBLIC_INSFORGE_URL` |
| **Authorize.net** | Card vault (Accept.js), one-time charges, recurring billing (ARB), webhooks | [account.authorize.net](https://account.authorize.net) — Fusion 4 Business merchant account |
| **Intuit Developer** | QuickBooks Online OAuth app, App Store listing (when published) | [developer.intuit.com](https://developer.intuit.com) |
| **Resend** | Transactional email on `contact.myprofitpulse.app` | [resend.com](https://resend.com) |
| **GitHub** | Source code, version history | [github.com/joycehayward1/ProfitPulse](https://github.com/joycehayward1/ProfitPulse) |
| **Domain / DNS** | `myprofitpulse.app`, `www` | Domain registrar + Vercel Domains |

**Why Authorize.net (not Stripe):** Merchant of record is Bermuda-based (Fusion 4 Business). Authorize.net supports that setup; Stripe was deliberately not used.

**Why InsForge (not Supabase directly):** BaaS with Postgres, auth, RLS, and an OpenAI-compatible AI gateway — same mental model as Supabase, with `@insforge/sdk` in the app.

---

## 3. GitHub & Deployment Workflow

### Repository

- **URL:** `https://github.com/joycehayward1/ProfitPulse`
- **Primary branches:** `main` (production source of truth), `staging` (integration / pre-prod)
- **Commit style:** Conventional prefixes — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

### Recommended developer workflow

```
feature branch → PR → merge to staging → test → merge to main → Vercel auto-deploys Production
```

**Production site:** [myprofitpulse.app](https://myprofitpulse.app)  
**Vercel project:** `profit-pulse2/profit-pulse`

### Deploying changes

1. Merge to `main` on GitHub (or push to `main`).
2. Vercel builds automatically (`npm run build`).
3. For env var changes (especially `NEXT_PUBLIC_*`), **redeploy** after updating Vercel → Settings → Environment Variables.

Manual deploy (if needed):

```bash
vercel deploy --prod --yes
```

### Cron jobs (Vercel)

Defined in `vercel.json`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/weekly-summary` | Mondays 09:00 UTC | Weekly scorecard emails |
| `/api/cron/arb-reconcile` | Daily 10:00 UTC | Sync Authorize.net ARB state with InsForge subscriptions |

Both require `CRON_SECRET` header on invocation (Vercel injects this for scheduled crons).

---

## 4. InsForge (Backend & Database)

### What lives here

- **Authentication** — email/password signup, login, password reset, email verification
- **PostgreSQL** — all app data with Row Level Security (users only see their own rows)
- **AI Gateway** — **ChatGPT** (`openai/gpt-4o-mini` via InsForge) for insights, spreadsheet extraction, and scenario explanations
- **Storage** — file uploads (if used)

### Key tables

| Table | Purpose |
|-------|---------|
| `profiles` | User name, business name, industry |
| `subscriptions` | Plan, billing interval, Authorize.net IDs, trial dates, `pricing_promo` (launch) |
| `payment_records` | Transaction history (amount, type, status) |
| `quickbooks_connections` | Encrypted OAuth tokens per user |
| `financial_data` / snapshots | Period financial metrics by source (manual, csv, quickbooks) |
| `health_assessments` | Assessment scores and AI summaries |
| `businesses`, `alerts`, `ai_insights` | Supporting product data |

Schema source files:

- `src/lib/schema.sql` — baseline
- `src/lib/migrations/` — incremental changes (e.g. `002_launch_pricing_promo.sql`)

Apply migrations via InsForge SQL editor or InsForge MCP `run-raw-sql`.

### Environment variables (InsForge)

```env
NEXT_PUBLIC_INSFORGE_URL=https://<project>.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=<anon-key>      # client-safe
INSFORGE_API_KEY=<admin-key>                  # server-only, never expose
```

---

## 5. Payments & Pricing (Authorize.net)

### Architecture summary

- **Accept.js** — card data tokenized in the browser; numbers never hit ProfitPulse servers
- **Customer Information Manager (CIM)** — vaulted customer + payment profiles for renewals
- **ARB (Automated Recurring Billing)** — recurring monthly/annual charges
- **Webhooks** — `POST /api/webhooks/authorize-net` (HMAC verified with `ANET_SIGNATURE_KEY`)

Detailed flow docs: `docs/payments-architecture.md`, `docs/PAYMENTS_PLAN.md`, `docs/PRODUCTION_CHECKLIST.md`

### Current pricing (live as of launch)

| Path | Monthly | Annual | Notes |
|------|---------|--------|-------|
| **Standard** (`/signup` → trial, then `/pricing`) | $59.99/mo | $599.88/yr (~$49.99/mo) | 7-day free trial, no card at signup |
| **Launch** (`/launch` from landing page) | $47.99/mo | $419.92/yr (~$35/mo) | 20% / 30% off **locked forever** via `pricing_promo: launch` |

Launch customers skip the trial path — they pay at checkout and go straight to active Pro.

### Payment API routes

| Route | Purpose |
|-------|---------|
| `POST /api/payments/subscribe` | First purchase / resubscribe |
| `POST /api/payments/cancel` | Cancel ARB; access until period end |
| `POST /api/payments/switch-plan` | Monthly ↔ annual upgrade/downgrade |
| `POST /api/payments/update-card` | New card on file |
| `POST /api/webhooks/authorize-net` | Payment + subscription lifecycle events |

### Authorize.net env vars

```env
NEXT_PUBLIC_ANET_API_LOGIN_ID=
NEXT_PUBLIC_ANET_CLIENT_KEY=
NEXT_PUBLIC_ANET_ENVIRONMENT=PRODUCTION
ANET_API_LOGIN_ID=
ANET_TRANSACTION_KEY=
ANET_SIGNATURE_KEY=
```

**Webhook URL (production):** `https://myprofitpulse.app/api/webhooks/authorize-net`

### Test pricing override (removed at launch)

`ANET_LIVE_TEST_AMOUNT` / `NEXT_PUBLIC_ANET_LIVE_TEST_AMOUNT` forced $1 charges during live validation. **Removed before public launch.** Do not re-enable in production unless intentionally testing again.

### Refunds & support

- Refunds are typically done in the **Authorize.net merchant dashboard** (Transaction Search → Refund/Void).
- In-app cancel stops future ARB billing; it does not automatically refund past charges.

---

## 6. QuickBooks Online (Intuit)

### Status

OAuth integration is **built and functional** for connecting a QuickBooks Online company, syncing accounting data, and powering dashboard/reports.

### OAuth flow

1. User clicks **Connect QuickBooks** (Settings → Integrations, Assessment, or Data page).
2. `GET /api/connect/quickbooks` → redirects to Intuit consent.
3. User approves → `GET /api/callback/quickbooks` exchanges code, encrypts tokens, stores in `quickbooks_connections`.
4. User can **disconnect** via Settings or `DELETE /api/quickbooks/disconnect`.

**Scope:** `com.intuit.quickbooks.accounting`

### Security

- Tokens encrypted at rest with **AES-256-GCM** (`TOKEN_ENCRYPTION_KEY` — 32-byte hex).
- Disconnect removes stored OAuth tokens from InsForge.

### Intuit Developer Portal checklist

| Item | Value |
|------|-------|
| Redirect URI (production) | `https://myprofitpulse.app/api/callback/quickbooks` |
| EULA URL | `https://myprofitpulse.app/terms#eula` |
| Privacy URL | `https://myprofitpulse.app/privacy` |
| Terms URL | `https://myprofitpulse.app/terms` |

Full integration guide: `docs/quickbooks-integration.md`

### App Store / production keys

- Sandbox app ≠ production app — create a **production** Intuit app for live customers.
- Complete Intuit security + marketing review before public App Store listing.
- Webhook auto-sync (QBO pushes changes) is **roadmapped for v2.6**, not v1.

---

## 7. Email (Resend)

Transactional and product email is sent through **Resend** on the verified domain **`contact.myprofitpulse.app`**.

| Setting | Value |
|---------|-------|
| **Sending domain** | `contact.myprofitpulse.app` |
| **From address** | `ProfitPulse <hello@contact.myprofitpulse.app>` |
| **Reply-to** | `hello@myprofitpulse.app` (customer replies go to the main inbox, not the transactional domain) |

**What Resend sends:**

- **Weekly summary** — Monday cron → scorecard-style recap
- Other product/notification emails routed through `src/lib/resend.ts`

**Not via Resend:**

- **Auth emails** (signup verification, password reset) — handled by InsForge auth

DNS: SPF, DKIM, and DMARC for `contact.myprofitpulse.app` must stay verified in the Resend dashboard.

```env
RESEND_API_KEY=re_...
```

See `docs/PRODUCTION_CHECKLIST.md` §6 for domain verification steps.

---

## 8. Legal & Compliance Pages

| Page | URL | Purpose |
|------|-----|---------|
| Terms + EULA | `/terms` (anchor `#eula`) | Subscription terms, QuickBooks/Intuit disclaimers, third-party beneficiary |
| Privacy | `/privacy` | Data handling, QuickBooks data, deletion rights |

Required for Intuit app approval and customer trust. Contact in docs: `hello@myprofitpulse.app`

---

## 9. User Journeys (Quick Reference)

### A. Standard signup (free trial)

```
Landing → Get Started → /signup → 7-day trial → Dashboard
         → Upgrade → /pricing → Pay → Active Pro
```

### B. Launch pricing (Joyce’s launch offer)

```
Landing → Claim Launch Pricing → /launch → pick monthly/annual
         → create account (if needed) → Pay → Active Pro at locked launch rate
```

### C. QuickBooks user

```
Signup → Settings → Integrations → Connect QuickBooks → OAuth → Sync data → Dashboard/Reports
```

### D. Operator admin

```
Login with ADMIN_EMAILS allow-listed email → /admin
         → stats, user list, extend trial, grant Pro
```

```env
ADMIN_EMAILS=joyce@fusion4business.com,...
```

---

## 10. Environment Variables (Complete Checklist)

See `.env.example` and `docs/PRODUCTION_CHECKLIST.md` for the full audit.

| Category | Variables |
|----------|-----------|
| App | `NEXT_PUBLIC_APP_URL` |
| InsForge | `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY` |
| Authorize.net | `NEXT_PUBLIC_ANET_*`, `ANET_*` |
| QuickBooks | `INTUIT_CLIENT_ID`, `INTUIT_CLIENT_SECRET`, `INTUIT_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` |
| Email | `RESEND_API_KEY` |
| Ops | `CRON_SECRET`, `ADMIN_EMAILS` |

**Rule:** Never commit secrets. All production values live in **Vercel → Environment Variables → Production** only.

---

## 11. Product Roadmap — v2 and Beyond

Source: `ROADMAP.md` (summarized for planning)

### v1 — Shipped ✅

Health score, dashboard KPIs, four scenario calculators, P&L / cash flow / balance sheet reports, QuickBooks OAuth + sync, CSV/Excel AI upload, billing (Authorize.net), launch pricing path, admin panel, weekly email cron.

---

### v2 — Intelligence & Planning Layer

| Feature | Priority | Summary |
|---------|----------|---------|
| **Budget vs Actual** | High | Pull QBO budgets or manual entry; variance on P&L; alerts when >10% over budget |
| **6-Month Cash Forecast** | High | Rolling averages + user-adjustable assumptions; runway projection chart |
| **More scenarios** | Medium | Hit My Budget, Income Target, Revenue +X%, Equipment Purchase |
| **Labor Cost % & AR Days KPIs** | Medium | New dashboard metrics from QBO payroll + receivables |
| **Revenue projections** | Medium | Forward quarterly revenue by stream vs actuals |
| **QBO webhook auto-sync** | Low | Real-time sync when books change (requires Intuit webhook registration) |

**Theme:** Move from “what happened?” to “what’s coming?” — forecasting and budget intelligence.

---

### v3 — Multi-Entity & Collaboration

| Feature | Summary |
|---------|---------|
| **Multi-company** | Multiple QBO companies per user, consolidated view |
| **Accountant / advisor access** | Read-only shared dashboards, comments, audit log |
| **Custom KPI builder** | User-defined formulas + industry benchmarks |
| **Automated AI insights** | Anomaly detection, trend alerts, natural language Q&A |
| **Report export** | Branded PDF, share links, CSV export |
| **Hiring & comp planning** | Deeper workforce / director comp scenarios |

**Theme:** ProfitPulse as a shared financial cockpit — owner, bookkeeper, and advisor in one place.

---

### Future premium tier (~$99/mo — not built)

From `docs/pricing-strategy.md`:

- Proactive smart alerts (pattern detection, not just thresholds)
- Custom KPI tracking
- Multi-entity support
- Industry benchmarking
- Advisor sharing
- Priority support + onboarding call

---

## 12. Key Files for Developers

| If you need to understand… | Start here |
|----------------------------|------------|
| Health score formula | `src/lib/healthScore.ts` |
| Main app home | `src/app/dashboard/page.tsx` |
| AI spreadsheet extraction | `src/app/api/extract-financials/route.ts` |
| Payments / ARB | `src/lib/authorize-net.ts`, `src/app/api/payments/*` |
| Launch pricing logic | `src/lib/plan-amounts.ts`, `src/app/launch/page.tsx` |
| QuickBooks OAuth | `src/lib/quickbooks.ts`, `src/app/api/callback/quickbooks/route.ts` |
| Feature gating (trial vs Pro) | `src/lib/feature-gate.ts` |
| Design tokens | `tailwind.config.ts`, `/showcase` |
| Production cutover | `docs/PRODUCTION_CHECKLIST.md` |

---

## 13. Operational Runbook

### Joyce / operator common tasks

| Task | How |
|------|-----|
| Grant someone Pro without payment | `/admin` → Grant Pro, or `POST /api/admin/grant-pro` |
| Extend a trial | `/admin` → Extend trial |
| Check MRR / user count | `/admin` stats |
| Refund a customer | Authorize.net dashboard → Transaction Search |
| Cancel someone’s subscription | User can self-serve Settings → Billing; or cancel ARB in Authorize.net |
| Update pricing site-wide | Code in `src/lib/plan-amounts.ts` + redeploy (ARB amounts only affect **new** subs unless updated in ANet) |
| Rotate API keys | Update Vercel env → redeploy; re-register webhooks/OAuth URIs if URLs change |

### When something breaks

1. **Vercel** → Deployments → Function logs (API route errors)
2. **Authorize.net** → Transaction search + ARB subscription list
3. **InsForge** → Database logs / SQL editor for subscription row state
4. **Intuit** → Developer portal → app logs / connection errors

---

## 14. Accounts & Access (Who Owns What)

| Asset | Owner / notes |
|-------|----------------|
| Domain `myprofitpulse.app` | Fusion 4 Business |
| Vercel team `profit-pulse2` | Invite developers as needed |
| GitHub `joycehayward1/ProfitPulse` | Joyce controls org access |
| Authorize.net merchant | Fusion 4 Business (Bermuda) |
| Intuit Developer app | Fusion 4 Business |
| InsForge project | Tied to Vercel env — transfer access via InsForge dashboard |
| Resend | `contact.myprofitpulse.app` — transactional sending domain |

Store credentials in a **password manager**, not in git. `.env.local` is gitignored.

---

## 15. Related Documentation Index

| Document | Contents |
|----------|----------|
| `README.md` | Developer setup, structure, env vars |
| `ROADMAP.md` | Full v2/v3 feature specs |
| `docs/PRODUCTION_CHECKLIST.md` | Launch-day cutover steps |
| `docs/quickbooks-integration.md` | QBO OAuth deep dive |
| `docs/payments-architecture.md` | Subscription lifecycle diagrams |
| `docs/PAYMENTS_PLAN.md` | Payment flows 1–8 (subscribe, switch, cancel, etc.) |
| `docs/pricing-strategy.md` | Competitive analysis + tier strategy |
| `docs/LEGAL_RESEARCH.md` | Terms/privacy research notes |
| `.env.example` | Environment variable template |

---

## 16. Launch Retrospective Notes (May 2026)

What was validated at launch:

- ✅ Production Authorize.net (Accept.js + ARB + webhooks)
- ✅ Standard signup + 7-day trial path
- ✅ Launch pricing path (`/launch`) with locked-in discounts
- ✅ Monthly → annual plan switch
- ✅ Resubscribe after cancel
- ✅ EULA / Terms for Intuit compliance
- ✅ Real pricing live ($59.99 / $599.88 standard; $47.99 / $419.92 launch)

**Post-launch cleanup:** Remove any test ARB subscriptions created during $1 validation testing (cancel in app + Authorize.net dashboard).

---

*Proprietary. © 2026 Fusion 4 Business. For internal handoff and operator reference.*
