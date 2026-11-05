import {
  addMonths,
  flowValue,
  makeMonthKey,
  monthNumberOf,
  monthRange,
  percentChange,
  recordFor,
  yearToDate,
  type MonthKey,
  type MonthlyData,
} from "@/lib/financial-periods";

/**
 * Goal Planning works on the calendar year (January–December). Months done are
 * the calendar months already over (or the last saved month, if later), and
 * months left = 12 − months done, so the current month always counts as left.
 * Revenue so far only includes saved months; months that are over but not
 * saved are listed in `unsavedPastMonths` so the page can say so.
 */

export type YtdSource = "saved_months" | "entered_ytd" | "none";

export interface GoalMonth {
  month: MonthKey;
  income: number | null;
  /** Running total of saved income from January through this month. */
  cumulative: number;
  /** Change from the previous calendar month; null if either is missing. */
  changeFromPrevious: number | null;
}

export interface GoalBaseline {
  year: number;
  /** Year-to-date figures to pre-fill, or null when there is nothing to go on. */
  revenueSoFar: number | null;
  expensesSoFar: number | null;
  source: YtdSource;
  /** Last month the year-to-date figures cover. */
  coveredThrough: MonthKey | null;
  monthsElapsed: number;
  monthsRemaining: number;
  /** Months between January and coveredThrough with nothing saved. */
  missingMonths: MonthKey[];
  /** Months that have already ended this year but come after coveredThrough. */
  unsavedPastMonths: MonthKey[];
  months: GoalMonth[];
}

export function buildGoalBaseline(data: MonthlyData, now: Date = new Date()): GoalBaseline {
  const year = now.getFullYear();
  const completedMonths = now.getMonth();
  const ytd = yearToDate(data, year);

  if (!ytd) {
    return {
      year,
      revenueSoFar: null,
      expensesSoFar: null,
      source: "none",
      coveredThrough: null,
      monthsElapsed: completedMonths,
      monthsRemaining: 12 - completedMonths,
      missingMonths: [],
      unsavedPastMonths: completedMonths > 0 ? monthRange(makeMonthKey(year, 1), makeMonthKey(year, completedMonths)) : [],
      months: [],
    };
  }

  const coveredThrough = ytd.end;
  const monthsElapsed = Math.min(11, Math.max(completedMonths, monthNumberOf(coveredThrough)));
  const useStated = ytd.missingMonths.length > 0 && ytd.stated?.revenue != null;

  let cumulative = 0;
  const months: GoalMonth[] = ytd.monthsInRange.map((month) => {
    const s = recordFor(data, month)?.snapshot;
    const income = s ? flowValue(s, "total_income") : null;
    cumulative += income ?? 0;
    const prev = recordFor(data, addMonths(month, -1))?.snapshot;
    const prevIncome = prev ? flowValue(prev, "total_income") : null;
    return { month, income, cumulative, changeFromPrevious: percentChange(income, prevIncome) };
  });

  return {
    year,
    revenueSoFar: useStated ? ytd.stated!.revenue : ytd.totals.total_income,
    expensesSoFar: useStated ? ytd.stated!.expenses : ytd.totals.total_expenses,
    source: useStated ? "entered_ytd" : "saved_months",
    coveredThrough,
    monthsElapsed,
    monthsRemaining: 12 - monthsElapsed,
    missingMonths: ytd.missingMonths,
    unsavedPastMonths:
      completedMonths > monthNumberOf(coveredThrough)
        ? monthRange(addMonths(coveredThrough, 1), makeMonthKey(year, completedMonths))
        : [],
    months,
  };
}

export interface GoalInputs {
  annualGoal: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  /** Year-to-date figures as typed; 0 or less means "not provided". */
  ytdRevenue: number;
  ytdExpenses: number;
  monthsRemaining: number;
}

export interface GoalComputation {
  monthsElapsed: number;
  revenueSoFar: number;
  revenueSoFarSource: "entered" | "estimated";
  expensesSoFar: number;
  expensesSoFarSource: "entered" | "estimated";
  ytdProfit: number;
  requiredMonthly: number;
  progressPercent: number;
  currentMonthlyProfit: number;
  /** % growth over current monthly revenue needed; null when revenue is zero. */
  growthRequired: number | null;
  status: "healthy" | "attention" | "critical";
}

/**
 * Months done is always 12 − months left, so the two never overlap. Missing
 * year-to-date figures are estimated as the monthly figure × months done.
 */
export function computeGoal(inputs: GoalInputs): GoalComputation {
  const monthsRemaining = Math.min(12, Math.max(1, Math.round(inputs.monthsRemaining)));
  const monthsElapsed = 12 - monthsRemaining;

  const revenueEntered = inputs.ytdRevenue > 0;
  const expensesEntered = inputs.ytdExpenses > 0;
  const revenueSoFar = revenueEntered ? inputs.ytdRevenue : inputs.monthlyRevenue * monthsElapsed;
  const expensesSoFar = expensesEntered ? inputs.ytdExpenses : inputs.monthlyExpenses * monthsElapsed;

  const requiredMonthly = Math.max(0, (inputs.annualGoal - revenueSoFar) / monthsRemaining);
  const progressPercent = inputs.annualGoal > 0 ? Math.min((revenueSoFar / inputs.annualGoal) * 100, 100) : 0;
  const growthRequired =
    inputs.monthlyRevenue > 0 ? ((requiredMonthly - inputs.monthlyRevenue) / inputs.monthlyRevenue) * 100 : null;

  let status: GoalComputation["status"];
  if (progressPercent >= 80 || (growthRequired !== null && growthRequired <= 10)) status = "healthy";
  else if (growthRequired !== null && growthRequired <= 30) status = "attention";
  else status = "critical";

  return {
    monthsElapsed,
    revenueSoFar,
    revenueSoFarSource: revenueEntered ? "entered" : "estimated",
    expensesSoFar,
    expensesSoFarSource: expensesEntered ? "entered" : "estimated",
    ytdProfit: revenueSoFar - expensesSoFar,
    requiredMonthly,
    progressPercent,
    currentMonthlyProfit: inputs.monthlyRevenue - inputs.monthlyExpenses,
    growthRequired,
    status,
  };
}
