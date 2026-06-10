import { getInsForgeClient } from "@/lib/insforge";
import type { FinancialSnapshot } from "@/lib/database.types";

/**
 * Smart defaults for the scenario calculators, derived from the user's
 * uploaded/entered financial data so they don't have to re-type numbers
 * the app already knows. Every value is a suggestion — the inputs stay
 * fully editable.
 */
export interface FinancialDefaults {
  /** Mean monthly revenue/expenses across the most recent snapshots (up to 12). */
  avgMonthlyRevenue: number | null;
  avgMonthlyExpenses: number | null;
  /** Stored YTD figures if the user provided them, otherwise summed from this year's monthly entries. */
  ytdRevenue: number | null;
  ytdExpenses: number | null;
  /** Most recent month's numbers. */
  latestMonthlyRevenue: number | null;
  latestMonthlyExpenses: number | null;
  /** Cash on hand from the latest balance-sheet data. */
  latestCash: number | null;
}

const EMPTY_DEFAULTS: FinancialDefaults = {
  avgMonthlyRevenue: null,
  avgMonthlyExpenses: null,
  ytdRevenue: null,
  ytdExpenses: null,
  latestMonthlyRevenue: null,
  latestMonthlyExpenses: null,
  latestCash: null,
};

interface AssessmentDefaultsRow {
  monthly_revenue: number | null;
  monthly_expenses: number | null;
  ytd_revenue: number | null;
  ytd_expenses: number | null;
  cash_on_hand: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function positiveNumbers(values: Array<number | null>): number[] {
  return values.filter((v): v is number => typeof v === "number" && v > 0);
}

export async function loadFinancialDefaults(
  userId: string
): Promise<FinancialDefaults> {
  const client = getInsForgeClient();

  const { data: snapshots } = await client.database
    .from("financial_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("period_date", { ascending: false })
    .limit(12);

  const rows = (snapshots ?? []) as FinancialSnapshot[];

  if (rows.length === 0) {
    // No uploaded data yet — fall back to the health assessment questionnaire.
    const { data: assessments } = await client.database
      .from("health_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    const assessment = (assessments?.[0] ?? null) as AssessmentDefaultsRow | null;
    if (!assessment) return EMPTY_DEFAULTS;

    return {
      avgMonthlyRevenue: assessment.monthly_revenue ?? null,
      avgMonthlyExpenses: assessment.monthly_expenses ?? null,
      ytdRevenue: assessment.ytd_revenue ?? null,
      ytdExpenses: assessment.ytd_expenses ?? null,
      latestMonthlyRevenue: assessment.monthly_revenue ?? null,
      latestMonthlyExpenses: assessment.monthly_expenses ?? null,
      latestCash: assessment.cash_on_hand ?? null,
    };
  }

  const latest = rows[0];
  const incomes = positiveNumbers(rows.map((r) => r.total_income));
  const expenses = positiveNumbers(rows.map((r) => r.total_expenses));

  // YTD: prefer an explicitly entered figure on the latest entry; otherwise
  // add up this calendar year's monthly entries.
  const yearPrefix = `${new Date().getFullYear()}-`;
  const thisYear = rows.filter((r) => r.period_date?.startsWith(yearPrefix));
  const summedYtdRevenue = positiveNumbers(thisYear.map((r) => r.total_income));
  const summedYtdExpenses = positiveNumbers(thisYear.map((r) => r.total_expenses));

  return {
    avgMonthlyRevenue: average(incomes),
    avgMonthlyExpenses: average(expenses),
    ytdRevenue:
      latest.ytd_revenue ||
      (summedYtdRevenue.length > 0
        ? summedYtdRevenue.reduce((a, b) => a + b, 0)
        : null),
    ytdExpenses:
      latest.ytd_expenses ||
      (summedYtdExpenses.length > 0
        ? summedYtdExpenses.reduce((a, b) => a + b, 0)
        : null),
    latestMonthlyRevenue: latest.total_income ?? null,
    latestMonthlyExpenses: latest.total_expenses ?? null,
    latestCash: latest.current_assets ?? null,
  };
}
