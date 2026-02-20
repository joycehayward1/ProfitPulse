# Dashboard Directory

## Overview
The dashboard is the main landing page for authenticated users. It displays a personalized greeting, current date, and the user's business health status.

## Components

### DashboardPage (`page.tsx`)
Main dashboard page component with two states:
1. **Empty state**: When user has no assessment data - shows warm invitation to complete assessment
2. **Health Score state**: When assessment exists - displays health score gauge with breakdown (US-015+ will add metric cards)

## Patterns & Conventions

### Time-of-Day Greeting
- `getTimeOfDay()` utility returns "morning" (< 12), "afternoon" (< 18), or "evening"
- Greeting personalized with user name (currently placeholder "Jessica")
- Date formatted using `Intl.DateTimeFormatOptions` for localized display

### Data Fetching
- Fetches latest assessment from `health_assessments` table on mount
- Currently placeholder (no InsForge credentials) - shows empty state by default
- TODO: Replace with real InsForge query when credentials available

### Staggered Animations
- Uses `animation-delay` with inline styles for cascading fade-in effect
- Delays: greeting (0ms), name (200ms), date (300ms), card (400ms+)
- CSS keyframe `fadeIn` animation defined in `<style jsx>` block

### Empty State Design
- Warm invitation tone: "Let's get you some clarity"
- Orange-bordered card with gradient background
- Decorative orange glow effect for visual interest
- Clear CTA button linking to `/assessment`

### Health Score Display (when implemented)
- HealthScoreGauge component at "lg" size
- StatusBadge shows health tier (Healthy/Attention/Critical)
- Breakdown shows three formula components with descriptions
- TODO: Calculate delta from historical data (placeholder "+5 from last week")

## Gotchas

### SSR/Hydration
- **CRITICAL**: Never use a `mounted` state check that returns `null` before mount
- This causes the component to never render in the browser (blank page)
- React hydration expects server and client markup to match
- Time-sensitive data (greeting, date) should use client-side rendering, but still render initial content

### Responsive Design
- Desktop: greeting is 56px, two-column health score layout
- Mobile: greeting is 42px, stacked layout, hamburger menu in AppLayout
- Use `md:` breakpoint for responsive font sizes and grid layouts

## Future Enhancements (US-015+)
- Metric cards for Profit, Cash Flow, Runway
- Cash Position section with Money In/Out
- Real AI insights from InsForge AI Gateway
- Historical data for delta calculations
