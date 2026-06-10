-- Manual entry fields that were collected by the Data Entry form but never
-- persisted (receivables, inventory, YTD totals, expense breakdown).
-- Applied to production 2026-06-10.

ALTER TABLE financial_snapshots
  ADD COLUMN IF NOT EXISTS accounts_receivable double precision,
  ADD COLUMN IF NOT EXISTS inventory_value double precision,
  ADD COLUMN IF NOT EXISTS ytd_revenue double precision,
  ADD COLUMN IF NOT EXISTS ytd_expenses double precision,
  ADD COLUMN IF NOT EXISTS expense_breakdown jsonb;
