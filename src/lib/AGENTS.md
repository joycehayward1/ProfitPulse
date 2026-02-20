# Utility Functions - AGENTS.md

## Overview
This directory contains utility functions and helpers used throughout the application.

## Key Utilities

### healthScore.ts
**Health Score Calculation Engine**

Calculates business health score based on three weighted components:
- **Cash Runway (40%)**: Months of cash on hand divided by monthly expenses, normalized to 6 months
- **Profit Margin (30%)**: (Revenue - Expenses) / Revenue * 100, clamped 0-100
- **Receivables Health (30%)**: Inverse of receivables-to-revenue ratio (lower is better)

**Edge Cases Handled:**
- Zero expenses → runway score = 0
- Zero revenue → profit margin = 0, receivables score = 0 (not 100!)
- Negative profit → margin score clamped at 0
- High receivables (>100% of revenue) → score clamped at 0

**Exports:**
```typescript
calculateHealthScore(inputs: HealthScoreInputs): HealthScoreBreakdown
getHealthStatus(score: number): "healthy" | "attention" | "critical"
```

**Usage Pattern:**
```typescript
import { calculateHealthScore, getHealthStatus } from '@/lib/healthScore';

const breakdown = calculateHealthScore({
  cashOnHand: 60000,
  monthlyRevenue: 20000,
  monthlyExpenses: 10000,
  accountsReceivable: 5000,
});

const status = getHealthStatus(breakdown.totalScore);
// status: "healthy" (80+), "attention" (50-79), or "critical" (0-49)
```

### insforge.ts
**InsForge Client Singleton**

Provides singleton pattern for InsForge SDK:
- `getInsForgeClient()` - Browser-side client
- `getInsForgeAdmin()` - Server-side admin client (uses INSFORGE_ADMIN_KEY)

**CRITICAL:** InsForge SDK must be dynamically imported in "use client" components to avoid SSR errors.

### subscription.ts
**Subscription Tier Helper (Stubbed)**

Currently returns `"growth"` as default tier. Will be replaced with real Stripe integration later.

### database.types.ts
**Database Schema Types**

TypeScript types for all InsForge database tables:
- Profile, Subscription, HealthAssessment, FinancialData, etc.
- Insert/Update types for each table
- Enums: DataSource, AlertType, ScenarioType, SubscriptionStatus
- TABLE_NAMES constant for type-safe table references

## Common Patterns

### Dynamic InsForge Import
```typescript
// ✅ Correct (in "use client" component)
const { getInsForgeClient } = await import("@/lib/insforge");
const client = getInsForgeClient();

// ❌ Wrong (causes SSR errors)
import { getInsForgeClient } from "@/lib/insforge";
```

### Database Query Pattern
```typescript
const { data, error } = await client.database
  .from('health_assessments')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

## Testing Notes
- InsForge requires `global.fetch = jest.fn()` in tests
- Use `jest.resetModules()` + dynamic `require()` to test singleton patterns with different env vars
- Database types have comprehensive test coverage (14 tests)
