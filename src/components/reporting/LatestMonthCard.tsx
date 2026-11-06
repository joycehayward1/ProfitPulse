import { InfoTooltip } from "@/components/ui/MetricTooltip";
import { ChangeBadge } from "@/components/reporting/ChangeBadge";
import {
  flowValue,
  latestMonth,
  listMonths,
  monthLabel,
  percentChange,
  previousMonth,
  sameMonthLastYear,
  type FlowField,
  type MonthlyData,
} from "@/lib/financial-periods";
import { formatMoney } from "@/lib/format-money";

const ROWS: { field: FlowField; label: string; higherIsBetter: boolean; tooltip: string }[] = [
  { field: "total_income", label: "Total Income", higherIsBetter: true, tooltip: "All revenue your business earned before any expenses are deducted." },
  { field: "gross_profit", label: "Gross Profit", higherIsBetter: true, tooltip: "Revenue minus the direct costs of delivering your services. Shows how efficiently you deliver." },
  { field: "total_expenses", label: "Total Expenses", higherIsBetter: false, tooltip: "All business costs including payroll, rent, software, marketing, and overhead. A rise is shown in red." },
  { field: "net_profit", label: "Net Profit", higherIsBetter: true, tooltip: "The bottom line — what's left after all expenses. This is the true measure of profitability." },
];

/** The most recent saved month compared with the calendar month before it and the same month last year. */
export function LatestMonthCard({ data }: { data: MonthlyData }) {
  const latest = latestMonth(data);
  if (!latest) return null;
  const prev = previousMonth(data, latest.month);
  const lastYear = sameMonthLastYear(data, latest.month);

  const notes: string[] = [];
  if (!prev.record) notes.push(`${monthLabel(prev.month)} isn't saved, so there's no month-on-month comparison.`);
  if (latest.ignoredDuplicates > 0) {
    notes.push(`${monthLabel(latest.month)} was saved ${latest.ignoredDuplicates + 1} times; the most recent save is used.`);
  }
  if (data.futureMonths.length > 0) {
    notes.push(`Left out because ${data.futureMonths.length === 1 ? "it is" : "they are"} dated in the future: ${listMonths(data.futureMonths)}.`);
  }

  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card" data-testid="latest-month-card">
      <h2 className="text-heading font-semibold text-text-primary">
        Latest saved month{" "}
        <span className="ml-1 normal-case tracking-normal text-text-secondary">— {monthLabel(latest.month)}</span>
      </h2>
      <p className="text-body-sm text-text-muted mb-sm">The most recent month you&apos;ve saved, not necessarily this month.</p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-light">
              <th className="text-left py-2 pr-md text-label uppercase tracking-wider text-text-muted">Metric</th>
              <th className="text-right py-2 px-md text-label uppercase tracking-wider text-text-muted">{monthLabel(latest.month, "short")}</th>
              <th className="text-right py-2 px-md text-label uppercase tracking-wider text-text-muted">vs {monthLabel(prev.month, "short")}</th>
              <th className="text-right py-2 pl-md text-label uppercase tracking-wider text-text-muted hidden sm:table-cell">vs {monthLabel(lastYear.month, "short")}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const value = flowValue(latest.snapshot, row.field);
              const prevValue = prev.record ? flowValue(prev.record.snapshot, row.field) : null;
              const lastYearValue = lastYear.record ? flowValue(lastYear.record.snapshot, row.field) : null;
              const isNet = row.field === "net_profit";
              return (
                <tr key={row.field} className="border-b border-border-light last:border-b-0">
                  <td className={`py-3 pr-md text-body ${isNet || row.field === "total_income" ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      <InfoTooltip text={row.tooltip} />
                    </span>
                  </td>
                  <td className={`text-right py-3 px-md text-body tabular-nums font-semibold ${isNet && value !== null ? (value < 0 ? "text-error" : "text-success") : "text-text-primary"}`}>
                    {formatMoney(value)}
                  </td>
                  <td className="text-right py-3 px-md text-body-sm tabular-nums">
                    <ChangeBadge change={percentChange(value, prevValue)} higherIsBetter={row.higherIsBetter} />
                  </td>
                  <td className="text-right py-3 pl-md text-body-sm tabular-nums hidden sm:table-cell">
                    <ChangeBadge change={percentChange(value, lastYearValue)} higherIsBetter={row.higherIsBetter} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
        <ul className="mt-sm space-y-0.5" data-testid="latest-month-notes">
          {notes.map((n) => (
            <li key={n} className="text-body-sm text-text-muted">{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
