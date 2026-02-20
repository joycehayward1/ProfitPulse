# src/lib - Shared Utilities

## Files
- `subscription.ts` — Stub for tier checking. Returns `"growth"` by default. Will be replaced with Stripe lookup.
- `database.types.ts` — TypeScript types for all InsForge database tables. Import types from here, not from InsForge SDK.
- `insforge.ts` — InsForge client singleton. Use `getInsForgeClient()` for browser/general use, `getInsForgeAdmin()` for server-only admin operations.

## Database Types
- **Row types:** `Profile`, `Subscription`, `HealthAssessment`, `FinancialData`, `ExpenseCategory`, `AlertConfig`, `AlertHistory`, `Scenario`, `QuickBooksConnection`
- **Insert types:** `ProfileInsert`, `FinancialDataInsert`, etc. — omit `id` and `created_at`
- **Update types:** `ProfileUpdate`, etc. — all fields optional except `id`/`user_id`/`created_at`
- **Enums:** `DataSource`, `AlertType`, `ScenarioType`, `SubscriptionStatus`
- **TABLE_NAMES** constant for type-safe table references

## InsForge Client
- `getInsForgeClient()` — singleton, uses `NEXT_PUBLIC_INSFORGE_URL` + `NEXT_PUBLIC_INSFORGE_ANON_KEY`
- `getInsForgeAdmin()` — new instance each call, uses `INSFORGE_API_KEY` (server-only, never expose to browser)
- The SDK requires `fetch` globally — tests must provide a mock: `global.fetch = jest.fn()`

## Patterns
- Export types alongside functions (e.g., `SubscriptionTier` type)
- Use eslint-disable comment for intentionally unused params in stubs
- Database queries use PostgREST syntax: `client.database.from('table').select('*').eq('user_id', id)`
- All tables have RLS enabled — users can only access their own rows via JWT
