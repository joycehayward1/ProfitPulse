# Assessment Results Page - AGENTS.md

## Purpose
Displays the calculated health score after completing the assessment questionnaire.

## Key Features
- Fetches most recent health_assessments record from InsForge
- Calculates health score using `calculateHealthScore()` from `@/lib/healthScore`
- Updates assessment record with calculated score
- Displays large HealthScoreGauge (size="lg")
- Shows StatusBadge with health tier (Healthy/Attention/Critical)
- Breaks down formula into three components with progress bars

## Component Breakdown

### Loading State
- Spinner animation while fetching and calculating
- "Calculating your health score..." message
- Shown until breakdown state is populated

### Score Display
- HealthScoreGauge at "lg" size (220px diameter)
- Centered with StatusBadge below
- Status-specific messaging based on tier

### Formula Breakdown
Each component shows:
- Component name and weight percentage (e.g., "40% of total score")
- Description text with calculated values (e.g., "You have 6 months of cash runway")
- Orange progress bar showing component score out of 100
- Score number on right side in Georgia font

### Error Handling
- Redirects to `/assessment` if no data found
- Redirects to `/assessment` on database error
- Toast notification with error message

## Data Flow
1. `useEffect` on mount fetches latest assessment
2. Calculate score using `calculateHealthScore()`
3. Update assessment record with calculated score
4. Display breakdown to user
5. "Continue to Dashboard" button → `/dashboard`

## Testing Notes
- Cannot fully browser-test without InsForge credentials (page redirects on DB error)
- Tests mock InsForge database calls
- Tests cover all three health tiers (healthy/attention/critical)
- Tests verify score update is called with correct value

## Common Gotchas
- Page requires placeholder user_id until real auth is implemented
- InsForge must be dynamically imported (`await import("@/lib/insforge")`)
- Results page is NOT accessible via direct navigation if no assessment exists
