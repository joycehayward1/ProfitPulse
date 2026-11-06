import type { FinancialSnapshot } from "@/lib/database.types";

/**
 * Fictional months used by the reporting tests (same numbers as the preview's
 * "Sample Studio Co."). Expected: January–April 2026 income 70,500, expenses
 * 57,500, net 13,000; cash 44,000 as of April; Feb–Apr average expenses
 * 19,166.67; January missing; the Apr 1 manual save and the 2027 row ignored.
 */
export function snapshot(
  period_date: string,
  income: number | null,
  expenses: number | null,
  extra: Partial<FinancialSnapshot> = {}
): FinancialSnapshot {
  return {
    id: `s-${period_date}-${extra.data_source ?? "spreadsheet"}`,
    user_id: "user-1",
    period_date,
    data_source: "spreadsheet",
    total_income: income,
    gross_profit: null,
    total_expenses: expenses,
    net_operating_income: null,
    net_profit: income !== null && expenses !== null ? income - expenses : null,
    gross_profit_margin: null,
    net_profit_margin: null,
    current_assets: null,
    fixed_assets: null,
    total_assets: null,
    current_liabilities: null,
    long_term_liabilities: null,
    equity: null,
    operating_activities: null,
    investing_activities: null,
    financing_activities: null,
    net_cash_flow: null,
    current_ratio: null,
    working_capital: null,
    roa: null,
    roe: null,
    pl_detail: null,
    bs_detail: null,
    cf_detail: null,
    prior_month_date: null,
    accounts_receivable: null,
    inventory_value: null,
    ytd_revenue: null,
    ytd_expenses: null,
    expense_breakdown: null,
    created_at: "2026-05-04T15:00:00Z",
    ...extra,
  } as FinancialSnapshot;
}

export const NOV_5_2026 = new Date(2026, 10, 5, 12);

export function sampleSnapshots(): FinancialSnapshot[] {
  return [
    snapshot("2025-04-30", 20000, 16000, { current_assets: 30000, net_cash_flow: 1500, created_at: "2025-05-05T15:00:00Z" }),
    snapshot("2025-12-31", 24000, 19000, { current_assets: 38000, net_cash_flow: 2000, created_at: "2026-01-06T15:00:00Z" }),
    snapshot("2026-02-28", 22000, 18000, { current_assets: 41000, net_cash_flow: 3000, operating_activities: 3500, investing_activities: -500 }),
    snapshot("2026-03-31", 23500, 18500, { current_assets: 42500, net_cash_flow: 1500, operating_activities: 2000, investing_activities: -500 }),
    snapshot("2026-04-01", 23000, 20000, { current_assets: 43000, data_source: "manual", created_at: "2026-04-20T15:00:00Z" }),
    snapshot("2026-04-30", 25000, 21000, { current_assets: 44000, net_cash_flow: 1500, operating_activities: 2500, investing_activities: -1000 }),
    snapshot("2027-06-30", 99999, 99999, { current_assets: 99999 }),
  ];
}
