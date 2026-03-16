# ProfitPulse

A CEO dashboard for service-based business owners that provides clear, actionable financial insights without the complexity of traditional accounting software.

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Status](#project-status)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Key Features](#key-features)
- [Database Schema](#database-schema)
- [Design System](#design-system)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [Next Steps](#next-steps)

---

## 🎯 Overview

**Client:** Joyce Hayward / Fusion 4 Business (Bermuda)
**Built by:** Apps Built With AI
**Version:** 1.0 MVP (February 2026)

ProfitPulse transforms scattered financial data into a simple, visual dashboard with:
- Traffic-light health indicators (Green/Amber/Red)
- AI-powered plain-English insights
- Interactive Scenario Calculators (hero feature)
- Business Health Score (1-100) with transparent formula
- Multi-channel data input (CSV/Excel upload + QuickBooks sync)
- Automated weekly summaries and threshold alerts

**Target Market:** First-generation service-based business owners who need CFO-level insights without the $2,500-$5,000/month cost of a fractional CFO.

**Monetization:** Subscription tiers ($49/$99/$199/month) with Authorize.net payment processing (Bermuda-compliant).

---

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Phosphor Icons (via @iconify/react)
- **UI Components:** Custom design system aligned to brand

### Backend
- **BaaS:** InsForge (https://docs.insforge.dev)
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication (email/password + magic links)
  - AI Gateway (same pricing as direct OpenAI/Anthropic)
  - Edge Functions (Deno runtime)
  - Storage (file uploads)

### Integrations
- **Payment:** Authorize.net (Bermuda-compliant, NOT Stripe)
- **Accounting:** QuickBooks Online (OAuth2)
- **Email:** Resend (transactional emails + weekly summaries)
- **AI:** Google Gemini via InsForge AI Gateway
- **File Parsing:** Papa Parse (CSV) + SheetJS (Excel)

### Testing
- **Framework:** Jest + React Testing Library
- **Coverage:** Unit tests for components, pages, and utilities

---

## ✅ Project Status

### Completed (Phases 1-4)

**Phase 1: Foundation** ✅
- US-001: Project Scaffolding & Tailwind Config
- US-002: Core UI Components (Button, Input, Card, Toast, StatusBadge, etc.)
- US-003: Health Score Gauge & Traffic Light Components
- US-004: Landing Page with hero, features, pricing, CTA

**Phase 2: Authentication & Database** ✅
- US-005: Database Schema (users, businesses, health_assessments, financial_data, ai_insights, alerts)
- US-006: Sign Up & Login Pages
- US-007: Password Reset & Email Verification
- US-010: Authenticated App Layout with Navigation

**Phase 3: Health Assessment** ✅
- US-011: Health Assessment Questionnaire UI (12 questions, plain-English)
- US-012: Score Calculation (transparent formula, weighted metrics)
- US-013: AI-powered Summary & Top 3 Recommendations

**Phase 4: Dashboard & Scenario Calculators** ✅
- US-014: Dashboard Layout with Greeting & Health Score Card
- US-015: Metric Cards (Cash Position, Runway, Burn Rate, Revenue Growth)
- US-016: Manual Data Entry Forms
- US-017: CSV/Excel Spreadsheet Upload (drag-and-drop, multi-file)
- US-018: Scenario Calculator Page Layout
- US-019: Break-Even Calculator
- US-020: Goal Planning Calculator
- US-021: Hiring Readiness Calculator
- US-022: Cash Runway & Shortfall Recovery Calculator
- US-023: AI Insights Engine

### Pending (Phases 5-6)

**Phase 5: Alerts & Email** (Requires Resend API Key)
- US-024: Alert Configuration & Threshold Settings
- US-025: Alert Email Sending & Threshold Checking
- US-026: Weekly Email Summary

**Phase 6: Payments & QuickBooks** (Requires Credentials)
- US-008: Authorize.net Checkout & Tier Selection
- US-009: Authorize.net Webhooks & Subscription Management
- US-027: QuickBooks OAuth Flow & Connection
- US-028: QuickBooks Data Sync
- US-029: Subscription Tier Feature Gating
- US-030: Settings & Profile Page
- US-031: Mobile Optimization & Final Polish

---

## 📁 Project Structure

```
profit-pulse/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx              # Landing page (/)
│   │   ├── signup/               # Sign up page
│   │   ├── login/                # Login page
│   │   ├── forgot-password/      # Password reset request
│   │   ├── reset-password/       # Password reset confirmation
│   │   ├── verify-email/         # Email verification
│   │   ├── assessment/           # Health assessment questionnaire
│   │   │   └── results/          # Assessment results & AI summary
│   │   ├── dashboard/            # CEO dashboard (main app)
│   │   ├── data/                 # Data entry (manual + upload)
│   │   ├── scenarios/            # Scenario calculators
│   │   │   ├── break-even/
│   │   │   ├── goal-planning/
│   │   │   ├── hiring/
│   │   │   └── runway/
│   │   ├── settings/             # User settings & profile
│   │   ├── chat/                 # AI chat interface
│   │   └── layout.tsx            # Root layout
│   ├── components/
│   │   ├── ui/                   # Design system components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── HealthScoreGauge.tsx
│   │   │   ├── TrafficLightDot.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── CurrencyInput.tsx
│   │   ├── layout/               # Layout components
│   │   │   └── AppLayout.tsx     # Authenticated app shell
│   │   ├── auth/                 # Auth-specific components
│   │   │   └── AuthLayout.tsx
│   │   └── Providers.tsx         # Context providers
│   ├── contexts/
│   │   └── AuthContext.tsx       # Authentication state
│   ├── lib/
│   │   ├── insforge.ts           # InsForge client initialization
│   │   ├── database.types.ts     # TypeScript types for database
│   │   ├── healthScore.ts        # Health score calculation logic
│   │   ├── subscription.ts       # Subscription tier utilities
│   │   └── ai-insights.ts        # AI insights generation
│   └── hooks/
│       └── useCountUp.ts         # Animated number counter
├── tasks/
│   └── prd-profitpulse.md        # Complete Product Requirements Doc
├── .env.example                  # Environment variable template
├── .env.local                    # Local environment (gitignored)
├── package.json
├── tailwind.config.ts            # Design system tokens
├── tsconfig.json
└── jest.config.js
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ and npm/yarn
- InsForge account (https://insforge.dev)
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd profit-pulse
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables) below).

### 4. Set Up InsForge Backend

**Required for Phase 2+:**

1. Create an InsForge project at https://insforge.dev
2. Copy your project URL and API keys
3. Run the database schema migration (see [Database Schema](#database-schema))
4. Enable Row Level Security policies
5. Configure authentication settings (email/password + magic links)

### 5. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 6. Run Tests

```bash
npm test
```

---

## 🔐 Environment Variables

### Required (Phase 1-4)

```env
# InsForge Backend
NEXT_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key
INSFORGE_API_KEY=your-admin-api-key
```

**How to get InsForge credentials:**
1. Sign up at https://insforge.dev
2. Create a new project
3. Go to Settings → API Keys
4. Copy URL, Anon Key, and Admin API Key

### Required (Phase 5 - Email)

```env
# Resend (Email)
RESEND_API_KEY=re_...
```

**How to get Resend API key:**
1. Sign up at https://resend.com
2. Create API key
3. Verify sending domain

### Required (Phase 6 - Payments & QuickBooks)

```env
# Authorize.net (Payment Processing)
NEXT_PUBLIC_AUTHORIZENET_API_LOGIN_ID=your-login-id
NEXT_PUBLIC_AUTHORIZENET_CLIENT_KEY=your-client-key
AUTHORIZENET_TRANSACTION_KEY=your-transaction-key
AUTHORIZENET_SIGNATURE_KEY=your-signature-key

# QuickBooks / Intuit (Accounting Integration)
INTUIT_CLIENT_ID=your-client-id
INTUIT_CLIENT_SECRET=your-client-secret
INTUIT_REDIRECT_URI=http://localhost:3000/api/callback/quickbooks
```

**How to get Authorize.net credentials:**
- Contact Joyce Hayward (client has Bermuda-based merchant account)

**How to get QuickBooks credentials:**
1. Create Intuit Developer account
2. Register OAuth2 app
3. Configure redirect URIs
4. Copy Client ID & Secret

---

## ✨ Key Features

### 1. Health Assessment (One-Time, Auto-Updates)
- 12 plain-English questions covering revenue, expenses, cash, customers
- Transparent scoring formula (1-100 scale)
- AI-powered summary with Top 3 recommendations
- Auto-updates when financial data changes (no re-takes)

### 2. CEO Dashboard
- **Health Score Card:** Gauge with traffic-light color coding
- **Metric Cards:** Cash Position, Runway, Burn Rate, Revenue Growth
- **Visual Design:** Georgia display font, orange accent (#E65100), clean white cards
- **Real-time Updates:** Syncs from manual entry, CSV upload, or QuickBooks

### 3. Scenario Calculators (Hero Feature)
- **Break-Even:** Calculate units/revenue needed to cover costs
- **Goal Planning:** Model revenue target scenarios with timeline
- **Hiring Readiness:** Assess affordability of new hires
- **Cash Runway:** Project runway and recovery from shortfalls
- **AI Analysis:** Plain-English explanations for every calculation

### 4. Multi-Channel Data Entry
- **Manual Forms:** Direct input for revenue, expenses, cash
- **Spreadsheet Upload:** Drag-and-drop CSV/Excel with auto-parsing
- **QuickBooks Sync:** OAuth2 flow for automatic data sync (Phase 6)

### 5. Alerts & Email (Phase 5)
- Threshold-based alerts (cash, runway, burn rate)
- Weekly automated summaries via Resend
- Email verification for new accounts

### 6. Subscription Tiers (Phase 6)
- **Starter ($49/mo):** Core dashboard + 1 scenario/month
- **Professional ($99/mo):** Unlimited scenarios + QuickBooks
- **VIP ($199/mo):** All features + priority support
- Authorize.net checkout (Bermuda-compliant)

---

## 🗄 Database Schema

The app uses InsForge (PostgreSQL) with the following tables:

### `users`
- Managed by InsForge Auth
- Stores: id, email, created_at, etc.

### `businesses`
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key → users)
- name (text)
- industry (text)
- tier ('starter' | 'professional' | 'vip')
- created_at, updated_at
```
**RLS:** Users can only access their own business.

### `health_assessments`
```sql
- id (uuid, primary key)
- business_id (uuid, foreign key → businesses)
- score (integer 1-100)
- responses (jsonb) -- questionnaire answers
- ai_summary (text)
- recommendations (jsonb)
- created_at
```
**RLS:** Users can only access assessments for their business.

### `financial_data`
```sql
- id (uuid, primary key)
- business_id (uuid, foreign key → businesses)
- period_start, period_end (date)
- revenue, expenses, profit_margin (numeric)
- cash_balance, accounts_receivable, accounts_payable (numeric)
- monthly_burn_rate, runway_months (numeric)
- revenue_growth_rate (numeric)
- data_source ('manual' | 'csv' | 'quickbooks')
- created_at, updated_at
```
**RLS:** Users can only access their business's financial data.

### `ai_insights`
```sql
- id (uuid, primary key)
- business_id (uuid, foreign key → businesses)
- insight_type ('health_summary' | 'scenario_analysis' | 'trend_alert')
- title (text)
- content (text)
- metadata (jsonb)
- created_at
```
**RLS:** Users can only access their business's insights.

### `alerts`
```sql
- id (uuid, primary key)
- business_id (uuid, foreign key → businesses)
- alert_type ('cash_low' | 'runway_short' | 'burn_high')
- threshold_value (numeric)
- is_active (boolean)
- email_enabled (boolean)
- created_at, updated_at
```
**RLS:** Users can only access their business's alerts.

**Migration:** Database schema SQL is in PRD (US-005). Apply via InsForge SQL editor.

---

## 🎨 Design System

### Typography
- **Display:** Georgia (serif) – used for headings, hero text
- **Body:** Arial (sans-serif) – used for paragraphs, UI text

**Note:** Design spec PDF originally called for Nunito Sans + Inter, but client approved Georgia + Arial for better readability and classic CEO aesthetic.

### Colors

**Primary Orange:** `#E65100`
Used for: Buttons, links, icons, accents

**Backgrounds:**
- Page Background: `#FFF8F5` (warm off-white)
- Card/Surface: `#FFFFFF` (clean white)

**Text:**
- Primary: `#2D2A26` (near-black)
- Secondary: `#6B6560` (medium gray)
- Muted: `#9A948E` (light gray)

**Functional (Health Indicators ONLY):**
- Success/Green: `#43A047` (score 71-100)
- Warning/Amber: `#F9A825` (score 41-70)
- Error/Red: `#D32F2F` (score 0-40)

**Accent (Use Sparingly):**
- Purple: `#7B1FA2` (CTAs, special highlights)

**Important:** Green/Amber/Red are ONLY for functional health indicators, NOT decorative elements.

### Spacing
- xs: 8px
- sm: 16px
- md: 24px
- lg: 32px
- xl: 48px
- 2xl: 64px

### Border Radius
- sm: 6px
- md: 10px
- lg: 16px
- full: 50% (circular)

### Icons
**Phosphor Icons** (via @iconify/react)
Used throughout for consistency: `ph:`, `ph:bold:`, `ph:duotone:`

Example:
```tsx
import { Icon } from '@iconify/react';
<Icon icon="ph:chart-line-bold" className="text-orange" />
```

---

## 👨‍💻 Development Workflow

### Branching Strategy
- **`main`**: Production-ready code (merge at launch)
- **`develop`**: Active development branch (current)
- **Feature branches:** Create from `develop`, merge back via PR

### Commit Convention
```
feat: Add break-even calculator
fix: Resolve health score rounding bug
docs: Update README with deployment steps
test: Add unit tests for AI insights
```

### Testing Strategy
- **Unit Tests:** All components in `__tests__/` directories
- **Coverage:** Run `npm test` before committing
- **E2E:** Manual testing until Phase 6

### Code Quality
- TypeScript strict mode enabled
- ESLint configured (Next.js rules)
- Run `npm run lint` before committing

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Test Coverage
```bash
npm test -- --coverage
```

### Test Structure
```
src/
├── app/
│   └── dashboard/
│       ├── page.tsx
│       └── __tests__/
│           └── page.test.tsx
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── __tests__/
│           └── Button.test.tsx
└── lib/
    ├── healthScore.ts
    └── __tests__/
        └── healthScore.test.ts
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy `main` branch for production
4. Deploy `develop` branch for staging

**Deployment Settings:**
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Node Version: 18.x

### Environment Variables on Vercel
Add all variables from `.env.local` to Vercel dashboard:
- Settings → Environment Variables
- Add separately for Production, Preview, Development

### Domain Setup
- Custom domain: TBD (client to provide)
- SSL: Auto-configured by Vercel

---

## 🔜 Next Steps

### Immediate (Handoff Checklist)
- [ ] **Get InsForge credentials from Joyce** (blocks Phase 2+ testing)
- [ ] **Set up Resend account** (blocks Phase 5)
- [ ] **Get Authorize.net credentials from Joyce** (blocks Phase 6)
- [ ] **Get QuickBooks OAuth credentials from Joyce** (blocks Phase 6)
- [ ] **Get logo assets (SVG/PNG)** (currently using placeholder)
- [ ] **Deploy to Vercel staging** (test full flow)

### Phase 5: Alerts & Email (3-5 days)
- [ ] US-024: Alert Configuration UI
- [ ] US-025: Email sending with Resend
- [ ] US-026: Weekly summary cron job

### Phase 6: Payments & QuickBooks (5-7 days)
- [ ] US-008: Authorize.net checkout flow
- [ ] US-009: Webhook handling for subscriptions
- [ ] US-027: QuickBooks OAuth2 flow
- [ ] US-028: QuickBooks data sync
- [ ] US-029: Tier-based feature gating
- [ ] US-030: Settings & profile page
- [ ] US-031: Mobile optimization

### Pre-Launch
- [ ] Full QA testing (all user flows)
- [ ] Performance optimization (Lighthouse audit)
- [ ] Security audit (RLS policies, auth flows)
- [ ] Legal pages (Terms, Privacy, Cookie Policy)
- [ ] Analytics setup (Google Analytics or Plausible)
- [ ] Customer support system (email or chat)

---

## 📚 Resources

- **PRD:** `/tasks/prd-profitpulse.md` (31 user stories, detailed acceptance criteria)
- **Design System PDF:** `/ProfitPulse_DesignSystem_v1.pptx (1).pdf`
- **InsForge Docs:** https://docs.insforge.dev
- **Authorize.net Docs:** https://developer.authorize.net
- **QuickBooks API:** https://developer.intuit.com
- **Resend Docs:** https://resend.com/docs

---

## 🤝 Support

For questions about this codebase:
- **Developer:** Apps Built With AI
- **Client:** Joyce Hayward (joyce@fusion4business.com)
- **PRD Reference:** All user stories documented in `/tasks/prd-profitpulse.md`

---

## 📝 License

Proprietary - © 2026 Fusion 4 Business / Apps Built With AI
