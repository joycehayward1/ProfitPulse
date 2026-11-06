import { monthKeyOf } from "@/lib/financial-periods";

export interface AssessmentSnapshotInput {
  userId: string;
  now: Date;
  source: "manual" | "quickbooks";
  revenue: number;
  expenses: number;
  cash: number;
  payables: number;
  ytdRevenue: number;
  ytdExpenses: number;
}

/**
 * The financial_snapshots row saved from the health check's typed answers,
 * dated the 1st of the current month. Year-to-date figures are only included
 * when the owner entered them, so a blank answer never overwrites a saved one.
 */
export function buildAssessmentSnapshot(input: AssessmentSnapshotInput) {
  return {
    user_id: input.userId,
    period_date: `${monthKeyOf(input.now)}-01`,
    data_source: input.source,
    total_income: input.revenue,
    total_expenses: input.expenses,
    net_profit: input.revenue - input.expenses,
    current_assets: input.cash,
    current_liabilities: input.payables,
    ...(input.ytdRevenue > 0 ? { ytd_revenue: input.ytdRevenue } : {}),
    ...(input.ytdExpenses > 0 ? { ytd_expenses: input.ytdExpenses } : {}),
  };
}
