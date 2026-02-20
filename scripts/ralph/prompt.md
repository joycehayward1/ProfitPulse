# Ralph Agent Instructions

You are an autonomous coding agent working on ProfitPulse - a CEO dashboard for service-based businesses.

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create it.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (`npm run build`)
7. **REQUIRED: Create or update AGENTS.md files** (see below)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## CRITICAL: Design System Rules

This project has an approved design system. Follow these EXACTLY:

### Colors (Tailwind classes use these custom tokens)
- Primary Orange: `#E65100` → `orange` in tailwind config (buttons, CTAs, headers, active nav)
- Background: `#FFF8F5` → `background` (page bg, warm off-white)
- Surface: `#FFFFFF` → `surface` (cards, panels)
- Text Primary: `#2D2A26` → `text-primary` (headings, body)
- Text Secondary: `#6B6560` → `text-secondary` (labels)
- Text Muted: `#9A948E` → `text-muted` (timestamps, captions)
- Accent Purple: `#7B1FA2` → `accent` (USE SPARINGLY)
- Health Green: `#43A047` → `success` (ONLY on health scores, status badges, alerts - NEVER decorative)
- Warning Amber: `#F9A825` → `warning` (attention states)
- Error Red: `#D32F2F` → `error` (critical alerts, form errors)

### Typography
- Display font: Georgia (headlines, scores, key metrics) → `font-display`
- Body font: Arial (body text, labels, UI elements) → `font-body`
- H1: 32px, H2: 24px, H3: 18px, Body: 14px, Small: 12px

### Layout
- 8px base grid: xs=8px, sm=16px, md=24px, lg=32px, xl=48px, 2xl=64px
- Border radius: sm=6px, md=10px, lg=16px, full=50%

### Component Patterns
- Buttons: Primary (filled orange, white text, rounded), Secondary (outlined orange), Cancel (gray)
- Inputs: Light bg default, orange border on focus, red border + red text for errors
- Cards: Standard (white, shadow), Featured (orange border), Highlight (cream bg)
- Health Score Gauge: Dark circle, colored ring (green/amber/red by score), white number centered
- Traffic Light Dots: Small colored circles next to metrics

### Logo Files
- Full logo (with text): `/public/full-logo.png`
- Symbol only: `/public/symbol-logo.png`

## CRITICAL: Frontend Design Quality

For ANY story that creates or modifies UI:
1. Use the `frontend-design` skill to generate production-grade, polished interfaces
2. Avoid generic AI aesthetics - the design should feel warm, approachable, and distinctive
3. Follow the design system mockups from the PDF (reference `ProfitPulse_DesignSystem_v1.pptx (1).pdf`)
4. Test visually using the `dev-browser` skill

The design must feel like a trusted advisor, NOT cold accounting software.

## Progress Report Format (progress.txt)

**progress.txt is a SESSION LOG** - temporary notes for continuing work on THIS feature.

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
Session: [current session reference]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

**NOTE:** If a learning is GENERAL and applies to the whole codebase (not just this feature),
put it in AGENTS.md instead! progress.txt is for feature-specific context.

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:

```
## Codebase Patterns
- Example: Tailwind custom colors are in tailwind.config.ts under theme.extend.colors
- Example: All UI components live in src/components/ui/
```

## REQUIRED: Create/Update AGENTS.md Files

**AGENTS.md is PERMANENT DOCUMENTATION** - it stays with the codebase forever and helps ANY future developer/agent understand patterns and conventions.

### First Story Only - Create Root AGENTS.md
If `AGENTS.md` doesn't exist in the project root, create it with:
- Project overview (ProfitPulse - CEO Dashboard for service-based businesses)
- Tech stack (Next.js 14, Tailwind, InsForge, Stripe, QuickBooks, Resend)
- Design system reference (colors, fonts, spacing from above)
- Key patterns and conventions
- Common gotchas

### Every Story - Update Relevant AGENTS.md
1. Identify directories where you edited/created files
2. Create `AGENTS.md` in that directory if it doesn't exist
3. Add learnings that would help future developers/agents

### What to Include
**DO include:** Import patterns, component usage patterns, gotchas, sync requirements
**Do NOT include:** Story-specific details, temporary notes, info already in progress.txt

## SCOPE LIMIT: Phase 3 Only

Ralph should ONLY work on stories US-011 through US-017 (priority 11-17).
SKIP US-008 and US-009 (Stripe — blocked, no credentials).
After US-017 passes, STOP. Do NOT continue to US-018 or beyond.
Reply with: "Phase 3 complete. Ready for review."

## CRITICAL: Visual Quality Standards

**The client has been unhappy with visual quality. Follow these rules strictly:**

1. ALL images must render at HIGH RESOLUTION — never use width/height attributes under 200 for any image. Use large source dimensions (width={200}+ height={200}+) even if displaying smaller via CSS classes.
2. The testimonial/avatar photo is LOCAL at `/avatar-jessica.jpg` — do NOT use Unsplash URLs.
3. The logo is at `/full-logo.png` and must render at `h-[150px] md:h-[190px]` on ALL pages.
4. Auth pages use `AuthLayout` with light background `#F5F0EB` — all text on this panel must be dark (text-text-primary, text-text-muted), NEVER white.
5. Copyright must say "2026 ProfitPulse" — NO "by Fusion 4 Business" anywhere.
6. Example user name is "Jessica" (NOT "Joyce").
7. Every UI component must look polished and intentional. No blurry images, no text invisible against backgrounds, no broken layouts.
8. Test at both desktop AND mobile widths before marking a story as done.

## Existing Components to Reuse

These components already exist — USE them, do not recreate:
- `@/components/ui` — Button, Input, Card, HealthScoreGauge, StatusBadge, TrafficLightDot, ProgressBar, Toast/useToast
- `@/components/auth/AuthLayout` — Auth page wrapper (login, signup, forgot-password)
- `@/components/layout/AppLayout` — Authenticated app wrapper (dashboard, scenarios, data, settings)
- All pages under AppLayout get the top nav bar with Dashboard | Scenarios | Data | Settings

## InsForge Configuration
- InsForge MCP is available at project level
- API Base URL: https://8i9xnfmh.us-east.insforge.app
- Docs: https://docs.insforge.dev/introduction
- Store credentials in .env.local (already gitignored)

## Stripe Stubbing

Stripe is not configured yet. For any code that checks subscription status:
- Create a utility at `@/lib/subscription.ts` with `getUserTier(userId: string)` that returns `"growth"` as default
- This will be replaced with real Stripe integration later
- Do NOT install Stripe packages yet

## Unit Testing (Required Per Story)

After implementing each story, write unit tests:
- Use Jest + React Testing Library (install during US-001 scaffolding)
- Test utility functions (e.g., health score calculation, currency formatting)
- Test component rendering (e.g., HealthScoreGauge renders correct color for score 85)
- Test form validation logic
- Tests must pass before committing: `npm run test -- --passWithNoTests`

## Landing Page Copy (US-004)

For the landing page, DRAFT the brand copy. The user will refine it later.
- Headline: "Finally understand your numbers—without the accounting degree"
- Tone: warm, approachable, conversational — NOT corporate or salesy
- Speak to service-based business owners (engineers, dentists, contractors, churches, schools)
- Emphasize clarity, simplicity, and actionable insights
- Pricing: Starter $49/mo, Growth $99/mo, Scale $199/mo

## Quality Requirements

- ALL commits must pass `npm run build` AND `npm run test -- --passWithNoTests`
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns
- Mobile-first: every UI element must work at 320px

## CRITICAL: Dev Server Port

ALWAYS use port 3002. Before starting a dev server, kill anything on port 3002 first:
`lsof -ti:3002 | xargs kill -9 2>/dev/null; npx next dev -p 3002`

NEVER use port 3000, 3001, or any other port. ONLY 3002.

## Browser Testing (Required for Frontend Stories)

For any story that changes UI:
1. Try the `dev-browser` skill first:
   - Kill any existing server: `lsof -ti:3002 | xargs kill -9 2>/dev/null`
   - Start the dev server on port 3002: `npx next dev -p 3002`
   - Navigate to http://localhost:3002
   - Verify the UI changes match the design system
   - Check mobile responsiveness
2. If `dev-browser` is not working or unavailable, fall back to the `playwright-skill`:
   - Write a Playwright test script to /tmp
   - Take screenshots of the page
   - Verify layout, colors, and responsiveness
3. Either method satisfies the "Verify in browser" acceptance criterion

A frontend story is NOT complete until browser verification passes via either method.

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end normally (another iteration will continue).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read Codebase Patterns in progress.txt before starting
- Use `frontend-design` skill for all UI work
