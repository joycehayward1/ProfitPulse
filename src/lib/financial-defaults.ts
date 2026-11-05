import { getInsForgeClient } from "@/lib/insforge";
import type { FinancialSnapshot } from "@/lib/database.types";
import {
  balanceAsOf,
  describeAverage,
  latestMonth,
  monthLabel,
  normalizeMonthly,
  recentMonthlyAverage,
  type MonthlyData,
} from "@/lib/financial-periods";
import { buildGoalBaseline, type GoalBaseline } from "@/lib/goal-planning";

/**
 * Smart defaults for the scenario calculators, derived from the user's saved
 * monthly data so they don't have to re-type numbers the app already knows.
 * Every value is a suggestion with a plain-language source; the inputs stay
 * fully editable.
 */
export interface DefaultFigure {
  value: number | null;
  /** Where the number came from, e.g. "average of February–April 2026 (3 months)". */
  source: string;
}

export type DefaultsSource = "saved_months" | "assessment" | "none";

export interface FinancialDefaults {
  sourceKind: DefaultsSource;
  /** Typical month: recent monthly average, never a year-to-date total. */
  monthlyRevenue: DefaultFigure;
  monthlyExpenses: DefaultFigure;
  /** Cash on hand as of the latest month that has it (never added across months). */
  cash: DefaultFigure;
  /** Year-to-date baseline for Goal Planning. */
  goal: GoalBaseline;
  monthly: MonthlyData;
}

export interface AssessmentDefaultsRow {
  monthly_revenue: number | null;
  monthly_expenses: number | null;
  ytd_revenue?: number | null;
  ytd_expenses?: number | null;
  cash_on_hand: number | null;
  created_at?: string | null;
}

const NONE: DefaultFigure = { value: null, source: "" };

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function figure(value: number | null, source: string): DefaultFigure {
  return value === null ? NONE : { value, source };
}

export function deriveFinancialDefaults(
  snapshots: FinancialSnapshot[],
  assessment: AssessmentDefaultsRow | null,
  now: Date = new Date()
): FinancialDefaults {
  const monthly = normalizeMonthly(snapshots, now);
  const goal = buildGoalBaseline(monthly, now);

  if (latestMonth(monthly)) {
    const revenue = recentMonthlyAverage(monthly, "total_income");
    const expenses = recentMonthlyAverage(monthly, "total_expenses");
    const cash = balanceAsOf(monthly, "current_assets");
    return {
      sourceKind: "saved_months",
      monthlyRevenue: figure(revenue.value, describeAverage(revenue)),
      monthlyExpenses: figure(expenses.value, describeAverage(expenses)),
      cash: figure(cash.value, cash.month ? `as of ${monthLabel(cash.month)}` : ""),
      goal,
      monthly,
    };
  }

  if (!assessment) {
    return { sourceKind: "none", monthlyRevenue: NONE, monthlyExpenses: NONE, cash: NONE, goal, monthly };
  }

  const label = "from your health check answers";
  const ytdRevenue = positive(assessment.ytd_revenue);
  return {
    sourceKind: "assessment",
    monthlyRevenue: figure(positive(assessment.monthly_revenue), label),
    monthlyExpenses: figure(positive(assessment.monthly_expenses), label),
    cash: figure(assessment.cash_on_hand ?? null, label),
    goal:
      ytdRevenue !== null
        ? { ...goal, revenueSoFar: ytdRevenue, expensesSoFar: positive(assessment.ytd_expenses), source: "entered_ytd" }
        : goal,
    monthly,
  };
}

export async function loadFinancialDefaults(userId: string, now: Date = new Date()): Promise<FinancialDefaults> {
  const client = getInsForgeClient();

  const { data: snapshots } = await client.database
    .from("financial_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("period_date", { ascending: false })
    .limit(120);

  const rows = (snapshots ?? []) as FinancialSnapshot[];
  let assessment: AssessmentDefaultsRow | null = null;
  if (!latestMonth(normalizeMonthly(rows, now))) {
    const { data: assessments } = await client.database
      .from("health_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    assessment = (assessments?.[0] ?? null) as AssessmentDefaultsRow | null;
  }

  return deriveFinancialDefaults(rows, assessment, now);
}
