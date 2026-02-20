# ProfitPulse - AGENTS.md

## Project Overview
ProfitPulse is a CEO Dashboard for service-based businesses (engineers, dentists, contractors, churches, schools). It provides financial health scoring, plain-English AI insights, scenario calculators, and alerts.

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS with custom design tokens
- **Backend:** InsForge (BaaS) - auth, database, AI gateway
- **Payments:** Stripe (stubbed for now — `getUserTier()` returns "growth")
- **Accounting:** QuickBooks integration (future)
- **Email:** Resend (future)

## Design System

### Colors (Tailwind tokens in `tailwind.config.ts`)
| Token | Hex | Usage |
|-------|-----|-------|
| `orange` | #E65100 | Primary CTA, active nav, buttons |
| `background` | #FFF8F5 | Page background (warm off-white) |
| `surface` | #FFFFFF | Cards, panels |
| `text-primary` | #2D2A26 | Headings, body text |
| `text-secondary` | #6B6560 | Labels, secondary text |
| `text-muted` | #9A948E | Timestamps, captions |
| `accent` | #7B1FA2 | Purple — USE SPARINGLY |
| `success` | #43A047 | Health scores ONLY (never decorative) |
| `warning` | #F9A825 | Attention states ONLY |
| `error` | #D32F2F | Critical alerts, form errors ONLY |

**Rule:** Green/Amber/Red are FUNCTIONAL ONLY — health indicators, status badges, alerts. Never decorative.

### Typography
- **Display:** `font-display` → Georgia, serif (headlines, scores, key metrics)
- **Body:** `font-body` → Arial, sans-serif (body text, labels, UI elements)
- Sizes: h1=32px, h2=24px, h3=18px, body=14px, small=12px

### Spacing (8px grid)
xs=8px, sm=16px, md=24px, lg=32px, xl=48px, 2xl=64px

### Border Radius
sm=6px, md=10px, lg=16px, full=50%

### Logo Files
- Full logo (with text): `/public/full-logo.png`
- Symbol only: `/public/symbol-logo.png`

## Key Patterns

### Path Aliases
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)

### Subscription Stub
- `@/lib/subscription.ts` exports `getUserTier(userId)` which returns `"growth"` as default
- Will be replaced with real Stripe integration later
- Do NOT install Stripe packages yet

### Testing
- Jest + React Testing Library
- Config: `jest.config.js` (JS, not TS — avoids ts-node dependency)
- Setup: `jest.setup.ts` (imports `@testing-library/jest-dom`)
- Test files: `__tests__/` directories adjacent to source files
- Run: `npm run test` or `npm run test -- --passWithNoTests`

### Build
- `npm run build` must pass before every commit
- `npm run test -- --passWithNoTests` must also pass

### Database Schema
- Types in `@/lib/database.types.ts` — all table types, insert types, update types, enums
- 9 tables: profiles, subscriptions, health_assessments, financial_data, expense_categories, alert_configs, alert_history, scenarios, quickbooks_connections
- All tables have RLS enabled — users can only access their own rows
- Migration script: `scripts/migrate.ts` (run with `npx tsx scripts/migrate.ts`)
- Tables created via InsForge Admin API (`POST /api/database/tables`)

### InsForge Client
- `@/lib/insforge.ts` — singleton client (`getInsForgeClient()`) and admin client (`getInsForgeAdmin()`)
- Environment variables: `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY`
- `.env.example` has all required env var templates
- Database queries use PostgREST syntax via `client.database.from('table')`

## Gotchas
- ESLint with `@typescript-eslint/no-unused-vars` is strict — unused params need eslint-disable comment
- Jest config must be `.js` (not `.ts`) unless `ts-node` is installed
- Next.js 14 uses App Router — all pages in `src/app/` directory
- No dark mode — the app has one theme only (warm off-white)
- InsForge SDK requires global `fetch` — tests must mock: `global.fetch = jest.fn()`
- InsForge database uses PostgREST (same API as Supabase) — `from().select().eq()` pattern
- **CRITICAL**: InsForge SDK must be dynamically imported in `"use client"` components: `const { getInsForgeClient } = await import("@/lib/insforge")` — static imports cause SSR/build failures
- Auth pages share `AuthLayout` component from `@/components/auth/AuthLayout`
