import {
  flowValue,
  latestMonth,
  monthLabel,
  percentChange,
  previousMonth,
  type MonthlyData,
} from "@/lib/financial-periods";
import { formatRatioPercent } from "@/lib/format-money";

/**
 * A one-paragraph summary of the latest saved month, built only from saved
 * figures. Nothing is inferred beyond what the numbers say; when there is
 * nothing to compare, the text says so instead of guessing.
 */
export function buildLatestMonthInsight(data: MonthlyData): string {
  const latest = latestMonth(data);
  if (!latest) {
    return "No insight yet. Save a month of figures on the Data page to see how your profit and expenses change from month to month.";
  }

  const label = monthLabel(latest.month);
  const income = flowValue(latest.snapshot, "total_income");
  const expenses = flowValue(latest.snapshot, "total_expenses");
  const net = flowValue(latest.snapshot, "net_profit");
  const margin = income !== null && income > 0 && net !== null ? net / income : null;

  const prev = previousMonth(data, latest.month);
  const prevLabel = monthLabel(prev.month);
  if (!prev.record) {
    const start = margin !== null ? `In ${label} your profit margin was ${formatRatioPercent(margin)}.` : `Your latest saved month is ${label}.`;
    return `${start} ${prevLabel} isn't saved, so there is nothing to compare it with yet.`;
  }

  const prevIncome = flowValue(prev.record.snapshot, "total_income");
  const prevNet = flowValue(prev.record.snapshot, "net_profit");
  const prevMargin = prevIncome !== null && prevIncome > 0 && prevNet !== null ? prevNet / prevIncome : null;

  const sentences: string[] = [];
  if (margin !== null && prevMargin !== null) {
    const points = (margin - prevMargin) * 100;
    const direction = Math.abs(points) < 0.05 ? "unchanged from" : points > 0 ? `up ${points.toFixed(1)} points from` : `down ${Math.abs(points).toFixed(1)} points from`;
    sentences.push(`In ${label} your profit margin was ${formatRatioPercent(margin)}, ${direction} ${formatRatioPercent(prevMargin)} in ${prevLabel}.`);
  } else if (margin !== null) {
    sentences.push(`In ${label} your profit margin was ${formatRatioPercent(margin)}.`);
  }

  const incomeChange = percentChange(income, prevIncome);
  const expenseChange = percentChange(expenses, flowValue(prev.record.snapshot, "total_expenses"));
  const describe = (name: string, change: number | null) =>
    change === null ? null : Math.abs(change) < 0.05 ? `${name} stayed the same` : `${name} ${change > 0 ? "rose" : "fell"} ${Math.abs(change).toFixed(1)}%`;
  const moves = [describe("Income", incomeChange), describe("expenses", expenseChange)].filter(Boolean);
  if (moves.length > 0) {
    const joined = moves.join(" and ");
    sentences.push(`${joined.charAt(0).toUpperCase()}${joined.slice(1)} compared with ${prevLabel}.`);
  }

  return sentences.length > 0 ? sentences.join(" ") : `Your latest saved month is ${label}.`;
}
