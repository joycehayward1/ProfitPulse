# ProfitPulse

ProfitPulse is a CEO dashboard for service-based business owners — the kind of operators who can read a P&L but don't want to live inside one. It takes the financial data they already have (a spreadsheet, a QuickBooks login, or a few numbers typed into a form) and turns it into a single page that answers the only three questions a small-business owner actually wakes up worrying about: *Am I making money? Do I have enough cash? What should I do next?*

A fractional CFO costs $2,500 to $5,000 a month. ProfitPulse is built for the owners who can't justify that yet but still need someone in the room with them when they're deciding whether to hire, raise prices, or take on a new client.

## What it actually does

Every account starts with a **Health Assessment**. Twelve plain-English questions, or — more commonly — a spreadsheet upload that the AI extracts into the same answers. The result is a single number from 1 to 100, calculated transparently from weighted metrics (revenue trend, margin, cash runway, customer concentration, etc.), and a short written summary with the top three things the owner should focus on.

From there, the **Dashboard** becomes the daily home. Cash position, runway, burn rate, and revenue growth, each with a traffic-light indicator. Green / amber / red appear *only* on health signals — never as decoration — so the colors mean something the moment a user sees them.

The hero of the product is the **Scenario Calculator** suite. Four calculators (break-even, goal planning, hiring readiness, cash runway) let an owner ask "what if?" before they commit. Every result is accompanied by an AI-generated plain-English explanation, not just numbers. This is the feature that turns ProfitPulse from a dashboard into a thinking partner.

Surrounding all of this:

- **Reports**: balance sheet, cash flow, and P&L views generated from connected data.
- **Data entry**: manual forms, CSV / Excel upload, or QuickBooks Online sync.
- **Alerts & weekly summaries**: threshold-based notifications and a Monday-morning email recap, sent via Resend.
- **Billing**: Pro subscription ($59.99/mo or $599.88/yr) plus a **launch pricing** path ($47.99/mo or $419.92/yr locked forever) — all via Authorize.net (Stripe was deliberately not used).
- **Admin panel**: user management, stats, and operator overrides.

## How it's built

ProfitPulse is a Next.js 14 App Router app written in TypeScript, styled with Tailwind, and deployed on Vercel. The backend is **InsForge** — a Supabase-style BaaS that provides Postgres with row-level security, authentication, storage, and an AI Gateway for LLM calls. There is no separate API server; the few backend routes that exist live alongside the frontend as Next.js route handlers (`src/app/api/*`).

External services are kept narrow and load-bearing:

| Concern | Service |
|---|---|
| Database, auth, storage, AI gateway | InsForge |
| Payments & recurring billing | Authorize.net (ARB) |
| Accounting sync | QuickBooks Online (OAuth2) |
| Transactional + scheduled email | Resend (`contact.myprofitpulse.app`) |
| AI model behind the gateway | ChatGPT (`openai/gpt-4o-mini` via InsForge) |
| Spreadsheet parsing | Papa Parse (CSV), SheetJS (Excel) |

Two cron jobs run on Vercel: `weekly-summary` every Monday at 09:00 UTC, and `arb-reconcile` daily at 10:00 UTC to reconcile Authorize.net's recurring billing state with our subscription records.

## The design system, briefly

Georgia for display, Arial for body. The brand color is a confident orange (`#E65100`) on a warm off-white background (`#FFF8F5`). The original design spec called for Nunito Sans and Inter, but Georgia + Arial tested better — it feels less like a SaaS template and more like something a CEO would actually use.

Phosphor Icons throughout (`@iconify/react`). Purple `#7B1FA2` exists but is used sparingly. The three functional colors — `#43A047` green, `#F9A825` amber, `#D32F2F` red — are reserved exclusively for health indicators.

Tokens live in `tailwind.config.ts` and there's a full visual reference at `/showcase` once the app is running.

---

# For developers

The rest of this document is the handoff guide.

## Project structure

```
src/
├── app/                      Next.js App Router routes
│   ├── page.tsx              Landing
│   ├── (auth)                signup, login, forgot-password, reset-password, verify-email
│   ├── assessment/           Health assessment flow + results
│   ├── dashboard/            Main app home
│   ├── data/                 Manual + spreadsheet entry
│   ├── scenarios/            Break-even, goal planning, hiring, runway calculators
│   ├── reports/              Balance sheet, cash flow, P&L
│   ├── settings/             Profile, billing, integrations, alerts
│   ├── billing/              Plan selection + payment
│   ├── admin/                Operator-only user management
│   ├── chat/                 AI chat interface
│   ├── glossary/             Financial term reference
│   ├── showcase/             Internal design system reference
│   ├── pricing/, launch/, terms/, privacy/
│   └── api/
│       ├── auth/             Email change, account deletion, session helpers
│       ├── payments/         Authorize.net subscribe / cancel / switch-plan / update-card
│       ├── webhooks/         Authorize.net webhook receiver
│       ├── quickbooks/       Status, disconnect, assessment-data, test
│       ├── connect/, callback/  OAuth2 flows
│       ├── cron/             weekly-summary, arb-reconcile
│       ├── extract-financials/  AI spreadsheet → structured data
│       ├── notifications/    Threshold alerts
│       └── admin/            Admin API endpoints
├── components/
│   ├── ui/                   Design system primitives
│   ├── layout/               AppLayout (authenticated shell)
│   └── auth/                 AuthLayout (public shell)
├── contexts/AuthContext.tsx
├── hooks/
└── lib/
    ├── insforge.ts           Client init
    ├── database.types.ts     DB types
    ├── healthScore.ts        Scoring formula
    ├── subscription.ts       Tier logic
    └── ai-insights.ts        LLM prompts + post-processing
```

## Getting it running locally

```bash
git clone https://github.com/joycehayward1/ProfitPulse.git
cd ProfitPulse
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open http://localhost:3000. The dev server, type checking, and Tailwind JIT all run together.

## Environment variables

The app won't boot without InsForge. Everything else degrades gracefully — a missing Resend key disables outbound email but doesn't break the app, a missing QuickBooks key just hides the integration.

### Always required

```env
NEXT_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=...
INSFORGE_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Authorize.net (payments)

```env
NEXT_PUBLIC_ANET_API_LOGIN_ID=...
NEXT_PUBLIC_ANET_CLIENT_KEY=...
NEXT_PUBLIC_ANET_ENVIRONMENT=sandbox   # or "production"
ANET_API_LOGIN_ID=...
ANET_TRANSACTION_KEY=...
ANET_SIGNATURE_KEY=...                 # used to verify webhooks
```

### QuickBooks Online (optional integration)

```env
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/callback/quickbooks
TOKEN_ENCRYPTION_KEY=...               # 32-byte hex, encrypts stored OAuth tokens
```

### Resend (email)

Transactional email sends from **`hello@contact.myprofitpulse.app`** (domain `contact.myprofitpulse.app`). Replies route to `hello@myprofitpulse.app`.

```env
RESEND_API_KEY=re_...
```

### Cron + admin

```env
CRON_SECRET=...                        # required header for /api/cron/* invocations
ADMIN_EMAILS=joyce@fusion4business.com,...   # comma-separated allow-list for /admin
```

## Database

InsForge is Postgres with RLS. The schema is documented in `tasks/prd-profitpulse.md` (US-005) and consists of five tables:

| Table | Purpose |
|---|---|
| `businesses` | One per user. Holds business name, industry, subscription tier. |
| `health_assessments` | The 1–100 score, the raw responses, AI summary, recommendations. |
| `financial_data` | Period-keyed revenue, expenses, cash, AR/AP, burn, runway, growth — plus a `data_source` of `manual`, `csv`, or `quickbooks`. |
| `ai_insights` | Generated explanations attached to assessments, scenarios, or alerts. |
| `alerts` | Per-business threshold configs for cash / runway / burn. |

Every table has RLS scoped to `auth.uid() = user_id` (directly, or through `business_id → businesses.user_id`). Apply schema changes via the InsForge SQL editor; raw SQL can also be sent through the `/api/admin` helpers in dev.

## Workflows

**Branching:** `main` is production — Vercel deploys Production from this branch. Use `staging` for integration testing before merging to `main`. Older branches (`develop`, feature branches) may exist but `main` is the source of truth for what's live.

**Commits:** conventional prefixes — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.

**Tests:** `npm test` runs Jest + React Testing Library. Tests live in `__tests__/` folders next to the code they cover.

**Lint / types:** `npm run lint` (ESLint, Next.js config) and TypeScript strict mode.

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/PRODUCT_REFERENCE_GUIDE.md](docs/PRODUCT_REFERENCE_GUIDE.md) | Full platform reference — stack, accounts, pricing, QBO, roadmap |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Quick notes for the next developer |
| [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | Launch / env cutover checklist |
| [docs/quickbooks-integration.md](docs/quickbooks-integration.md) | QuickBooks OAuth deep dive |
| [ROADMAP.md](ROADMAP.md) | v2 and v3 product direction |

## Deployment

The app is deployed on Vercel with Next.js as the framework preset. The build command is `npm run build`, output directory is `.next`, and the runtime is Node.js (default).

Environment variables must be configured in the Vercel dashboard for all three environments (Production, Preview, Development). Cron jobs are declared in `vercel.json` and execute against the production deployment.

Authorize.net needs a publicly reachable webhook URL pointing at `/api/webhooks/authorize-net` — configure this in the Authorize.net merchant dashboard once the production domain is live. The webhook handler verifies the HMAC signature using `ANET_SIGNATURE_KEY`.

## Where to look first

If you're new to this codebase:

1. [docs/PRODUCT_REFERENCE_GUIDE.md](docs/PRODUCT_REFERENCE_GUIDE.md) — read this first
2. [docs/HANDOFF.md](docs/HANDOFF.md) — operational quirks and deploy notes
3. `src/lib/healthScore.ts` — the scoring formula
4. `src/app/dashboard/page.tsx` — the page everything else feeds into
5. `src/lib/plan-amounts.ts` — standard vs launch pricing
6. `src/lib/authorize-net.ts` — payment / ARB integration
7. `src/app/api/extract-financials/route.ts` — AI spreadsheet extraction

## License

Proprietary. © 2026 Fusion 4 Business.
