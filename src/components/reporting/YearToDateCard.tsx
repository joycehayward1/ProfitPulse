"use client";

import { useState } from "react";
import { InfoTooltip } from "@/components/ui/MetricTooltip";
import { ChangeBadge } from "@/components/reporting/ChangeBadge";
import {
  availableYears,
  balanceAsOf,
  describeIncomparable,
  isComparablePeriod,
  listMonths,
  monthLabel,
  percentChange,
  priorYearSamePeriod,
  yearToDate,
  type MonthlyData,
} from "@/lib/financial-periods";
import { formatMoney, formatRatioPercent } from "@/lib/format-money";

/**
 * Income, expenses and profit added up from January through the latest saved
 * month of the chosen calendar year. Cash is a balance, so it is shown as of
 * that month instead of being added up.
 */
export function YearToDateCard({ data, title = "Year to date" }: { data: MonthlyData; title?: string }) {
  const years = availableYears(data);
  const [year, setYear] = useState<number | null>(null);
  const selectedYear = year ?? years[0];
  if (selectedYear === undefined) return null;

  const ytd = yearToDate(data, selectedYear);
  if (!ytd) return null;
  const prior = priorYearSamePeriod(data, ytd);
  const comparable = isComparablePeriod(ytd, prior);
  const cash = balanceAsOf(data, "current_assets", ytd.end);

  const tiles = [
    { key: "income", label: "Income", value: ytd.totals.total_income, prior: prior?.totals.total_income ?? null, higherIsBetter: true },
    { key: "expenses", label: "Expenses", value: ytd.totals.total_expenses, prior: prior?.totals.total_expenses ?? null, higherIsBetter: false },
    { key: "net", label: "Net profit", value: ytd.totals.net_profit, prior: prior?.totals.net_profit ?? null, higherIsBetter: true },
  ];

  const stated = ytd.stated;
  const statedDiffers =
    stated?.revenue != null && ytd.totals.total_income !== null && Math.abs(stated.revenue - ytd.totals.total_income) >= 1;

  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card" data-testid="ytd-card">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h2 className="text-heading font-semibold text-text-primary inline-flex items-center gap-1.5">
            {title}
            <InfoTooltip text="Added up from January through your latest saved month of the year. Uses the calendar year (January–December)." />
          </h2>
          <p className="text-body-sm text-text-secondary" data-testid="ytd-range">
            {ytd.label} · {ytd.monthsWithData.length} of {ytd.monthsInRange.length} months saved
          </p>
        </div>
        {years.length > 1 && (
          <label className="text-body-sm text-text-muted inline-flex items-center gap-2">
            Year
            <select
              aria-label="Year"
              value={selectedYear}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 px-2 rounded-lg border border-border bg-surface text-[13px] text-text-primary"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {ytd.missingMonths.length > 0 && (
        <p className="mt-sm text-body-sm text-text-primary bg-warning-subtle border border-warning/30 rounded-lg px-sm py-1.5" data-testid="ytd-missing">
          Not saved yet: {listMonths(ytd.missingMonths)}. {ytd.missingMonths.length === 1 ? "It is" : "They are"} not included in these totals.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md mt-md">
        {tiles.map((t) => (
          <div key={t.key} className="rounded-lg bg-surface-inset/60 p-md" data-testid={`ytd-${t.key}`}>
            <p className="text-body-sm text-text-muted">{t.label}</p>
            <p className={`text-[20px] font-semibold tabular-nums ${t.key === "net" && (t.value ?? 0) < 0 ? "text-error" : "text-text-primary"}`}>
              {formatMoney(t.value)}
            </p>
            {t.key === "net" && <p className="text-body-sm text-text-muted">Margin {formatRatioPercent(ytd.netMargin)}</p>}
            {comparable && (
              <p className="text-body-sm text-text-muted">
                <ChangeBadge change={percentChange(t.value, t.prior)} higherIsBetter={t.higherIsBetter} /> vs {selectedYear - 1}
              </p>
            )}
          </div>
        ))}
        <div className="rounded-lg bg-surface-inset/60 p-md" data-testid="ytd-cash">
          <p className="text-body-sm text-text-muted">Cash</p>
          <p className="text-[20px] font-semibold tabular-nums text-text-primary">{formatMoney(cash.value)}</p>
          <p className="text-body-sm text-text-muted">{cash.month ? `as of ${monthLabel(cash.month)} (a balance, not added up)` : "No balance saved"}</p>
        </div>
      </div>

      {prior && (
        <p className="mt-sm text-body-sm text-text-muted" data-testid="ytd-prior">
          {comparable
            ? `Compared with ${prior.label}, which has the same months saved.`
            : `Not compared with ${selectedYear - 1}: ${describeIncomparable(ytd, prior, prior.label)}.`}
        </p>
      )}
      {statedDiffers && stated?.revenue != null && (
        <p className="mt-sm text-body-sm text-text-muted" data-testid="ytd-stated">
          You entered {formatMoney(stated.revenue)} as year-to-date revenue for {monthLabel(stated.month)}; the saved months add up to {formatMoney(ytd.totals.total_income)}.
        </p>
      )}
    </div>
  );
}
