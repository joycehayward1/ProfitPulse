# scripts/ - Build & Migration Scripts

## Files
- `migrate.ts` — Creates all InsForge database tables via Admin API. Run with `npx tsx scripts/migrate.ts`. Requires `NEXT_PUBLIC_INSFORGE_URL` and `INSFORGE_API_KEY` in `.env.local`.
- `ralph/` — Autonomous agent configuration (PRD, progress tracking, prompt)

## Migration Notes
- Tables are created in dependency order (profiles first, expense_categories after financial_data)
- All tables have `rlsEnabled: true` — InsForge enforces row-level security via JWT user_id
- The `expense_categories` table has a foreign key to `financial_data.id` with CASCADE delete
- Column types match InsForge API: string, datetime, integer, float, boolean, uuid, json
