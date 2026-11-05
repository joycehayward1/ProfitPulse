"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { InfoTooltip } from "@/components/ui/MetricTooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { isInTrial } from "@/lib/feature-gate";
import { LockedFeature } from "@/components/LockedFeature";
import type { FinancialSnapshot } from "@/lib/database.types";
import { ChangeBadge } from "@/components/reporting/ChangeBadge";
import {
  addMonths,
  availableYears,
  changeTone,
  flowValue,
  latestMonth,
  listMonths,
  monthLabel,
  monthlyTrend,
  monthRangeLabel,
  normalizeMonthly,
  percentChange,
  previousMonth,
  priorYearSamePeriod,
  isComparablePeriod,
  describeIncomparable,
  recordFor,
  sameMonthLastYear,
  summarizePeriod,
  yearToDate,
  type PeriodSummary,
} from "@/lib/financial-periods";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PeriodOption = "1" | "3" | "6" | "12" | "ytd";

const PERIOD_LABELS: Record<PeriodOption, string> = {
  "1": "Latest Month",
  "3": "Last 3 Months",
  "6": "Last 6 Months",
  "12": "Last 12 Months",
  ytd: "Year to Date",
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

/** A margin as a percentage, worked out from the totals rather than the stored ratio. */
function marginPct(profit: number | null, income: number | null): number | null {
  if (profit === null || income === null || income <= 0) return null;
  return (profit / income) * 100;
}

function snapshotValues(s: FinancialSnapshot | null | undefined) {
  if (!s) return null;
  const income = flowValue(s, "total_income");
  const gross = flowValue(s, "gross_profit");
  const net = flowValue(s, "net_profit");
  return {
    total_income: income,
    gross_profit: gross,
    total_expenses: flowValue(s, "total_expenses"),
    net_operating_income: flowValue(s, "net_operating_income"),
    net_profit: net,
    gross_margin: marginPct(gross, income),
    net_margin: marginPct(net, income),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PLPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { subscription } = useAuth();
  const trialMode = isInTrial(subscription);
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>("3");
  const [ytdYear, setYtdYear] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch all snapshots once
  useEffect(() => {
    async function fetchSnapshots() {
      if (!user) return;
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { data, error } = await client.database
          .from("financial_snapshots")
          .select("*")
          .eq("user_id", user.id)
          .order("period_date", { ascending: false });

        if (!error && data) {
          setSnapshots(data as FinancialSnapshot[]);
        }
      } catch (err) {
        console.error("Error fetching snapshots:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSnapshots();
  }, [user]);

  const monthly = useMemo(() => normalizeMonthly(snapshots), [snapshots]);
  const latest = latestMonth(monthly);
  const years = availableYears(monthly);
  const selectedYear = ytdYear ?? years[0] ?? null;

  // The months on screen: counted back from the latest saved month (not from
  // today), or January to date for the chosen year.
  const range = useMemo((): PeriodSummary | null => {
    if (!latest) return null;
    if (period === "ytd") return selectedYear === null ? null : yearToDate(monthly, selectedYear);
    const months = parseInt(period);
    return summarizePeriod(monthly, addMonths(latest.month, -(months - 1)), latest.month);
  }, [monthly, latest, period, selectedYear]);

  const comparison = useMemo((): { summary: PeriodSummary | null; label: string; skipped: string | null } | null => {
    if (!range) return null;
    if (range.start === range.end) {
      const prev = addMonths(range.end, -1);
      return { summary: recordFor(monthly, prev) ? summarizePeriod(monthly, prev, prev) : null, label: monthLabel(prev, "short"), skipped: null };
    }
    const label = monthRangeLabel(addMonths(range.start, -12), addMonths(range.end, -12));
    const prior = priorYearSamePeriod(monthly, range);
    if (isComparablePeriod(range, prior)) return { summary: prior, label, skipped: null };
    return { summary: null, label, skipped: describeIncomparable(range, prior, label) };
  }, [monthly, range]);

  // KPI cards: totals for the months on screen
  const kpis = useMemo(() => {
    const t = range?.totals;
    const p = comparison?.summary?.totals;
    return [
      {
        label: "Total Income",
        value: t?.total_income ?? null,
        change: percentChange(t?.total_income, p?.total_income),
        higherIsBetter: true,
        icon: "ph:arrow-circle-down-bold",
        iconColor: "#43A047",
        tooltip: "All revenue your business earned before any expenses are deducted.",
      },
      {
        label: "Gross Profit",
        value: t?.gross_profit ?? null,
        change: percentChange(t?.gross_profit, p?.gross_profit),
        higherIsBetter: true,
        icon: "ph:trend-up-bold",
        iconColor: "#E65100",
        tooltip: "Revenue minus the direct costs of delivering your services or products.",
      },
      {
        label: "Total Expenses",
        value: t?.total_expenses ?? null,
        change: percentChange(t?.total_expenses, p?.total_expenses),
        higherIsBetter: false,
        icon: "ph:arrow-circle-up-bold",
        iconColor: "#ef4444",
        tooltip: "All business costs including payroll, rent, software, marketing, and overhead. A rise is shown in red.",
      },
      {
        label: "Net Profit",
        value: t?.net_profit ?? null,
        change: percentChange(t?.net_profit, p?.net_profit),
        higherIsBetter: true,
        isNetProfit: true,
        icon: "ph:chart-line-bold",
        iconColor: "#7B1FA2",
        tooltip: "The bottom line — what's left after all expenses. This is the true measure of profitability.",
      },
    ];
  }, [range, comparison]);

  // Chart data: every month in the range, gaps left empty
  const chartData = useMemo(() => {
    if (!range) return [];
    return monthlyTrend(monthly, range.end, range.monthsInRange.length).map((p) => ({
      month: p.label,
      Income: p.income,
      Expenses: p.expenses,
    }));
  }, [monthly, range]);
  const chartHasData = chartData.some((d) => d.Income !== null || d.Expenses !== null);

  // P&L table: the latest saved month against the same month last year and the calendar month before
  const tableMonth = latest?.month ?? null;
  const tableRows = useMemo(() => {
    if (!tableMonth) return [];
    const c = snapshotValues(recordFor(monthly, tableMonth)?.snapshot);
    const py = snapshotValues(sameMonthLastYear(monthly, tableMonth).record?.snapshot);
    const pm = snapshotValues(previousMonth(monthly, tableMonth).record?.snapshot);

    function row(
      label: string,
      key: keyof NonNullable<ReturnType<typeof snapshotValues>>,
      higherIsBetter: boolean,
      tooltip: string,
      isMargin = false
    ) {
      const cv = c?.[key] ?? null;
      const pyv = py?.[key] ?? null;
      const pmv = pm?.[key] ?? null;
      const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
      return {
        label,
        tooltip,
        current: cv,
        priorYear: pyv,
        pyVariance: isMargin ? diff(cv, pyv) : percentChange(cv, pyv),
        priorMonth: pmv,
        pmVariance: isMargin ? diff(cv, pmv) : percentChange(cv, pmv),
        isMargin,
        higherIsBetter,
      };
    }

    return [
      row("Income", "total_income", true, "All revenue your business earned before any expenses are deducted."),
      row("Gross Profit", "gross_profit", true, "Revenue minus the direct costs of delivering your services or products."),
      row("Gross Profit Margin %", "gross_margin", true, "Gross profit as a percentage of revenue. Higher means you keep more of each dollar earned.", true),
      row("Total Expenses", "total_expenses", false, "All business costs including payroll, rent, software, marketing, and overhead. A rise is shown in red."),
      row("Net Operating Income", "net_operating_income", true, "Profit from core business operations, before interest and taxes."),
      row("Net Profit", "net_profit", true, "The bottom line — what's left after all expenses."),
      row("Net Profit Margin %", "net_margin", true, "Net profit as a percentage of revenue. Shows how much of each dollar you actually keep.", true),
    ];
  }, [monthly, tableMonth]);

  const current = latest?.snapshot ?? null;

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-xl">
          <div className="h-9 w-48 bg-surface-inset rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-surface-inset rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-surface-inset rounded-lg animate-pulse" />
          <div className="h-64 bg-surface-inset rounded-lg animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  // Empty state
  if (!latest || !range) {
    return (
      <AppLayout>
        <div className="space-y-xl">
          <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
            Profit &amp; Loss
          </h1>

          <div className="bg-surface rounded-xl border border-border-light shadow-card p-2xl text-center">
            <div className="max-w-md mx-auto space-y-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange/[0.08] text-orange mx-auto">
                <Icon icon="ph:chart-line-up-bold" className="w-8 h-8" />
              </div>

              <div className="space-y-sm">
                <h2 className="text-[20px] font-semibold text-text-primary">
                  No P&L data yet
                </h2>
                <p className="text-[14px] text-text-secondary max-w-md mx-auto">
                  Upload a spreadsheet or enter data manually to see your Profit &amp; Loss report.
                </p>
              </div>

              <div className="pt-sm">
                <Link
                  href="/data"
                  className="inline-flex items-center gap-2 px-xl py-md bg-orange text-white text-[14px] font-semibold rounded-xl hover:bg-orange/90 transition-colors"
                >
                  <Icon icon="ph:database-bold" className="w-5 h-5" />
                  Connect Your Data
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
              Profit &amp; Loss
            </h1>
            {current && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  current.data_source === "quickbooks"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {current.data_source === "quickbooks" && (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
                {current.data_source === "quickbooks" ? "QuickBooks" : current.data_source === "spreadsheet" ? "Spreadsheet" : "Manual"}
              </span>
            )}
          </div>

          {/* Period selector */}
          <div className="relative flex items-center gap-2">
            {period === "ytd" && years.length > 1 && (
              <select
                aria-label="Year"
                value={selectedYear ?? undefined}
                onChange={(e) => setYtdYear(Number(e.target.value))}
                className="h-9 px-2 bg-surface border border-border rounded-lg text-[13px] text-text-primary"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 h-9 px-3 bg-surface border border-border rounded-lg text-[13px] text-text-primary font-medium hover:border-orange/40 transition-colors"
            >
              {PERIOD_LABELS[period]}
              <Icon icon="ph:caret-down-bold" className="w-4 h-4 text-text-muted" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-elevated overflow-hidden z-20 min-w-[180px]">
                {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setPeriod(key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                      period === key
                        ? "bg-orange/5 text-orange font-semibold"
                        : "text-text-secondary hover:bg-surface-inset/50"
                    }`}
                  >
                    {PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="-mt-md space-y-1" data-testid="pl-range">
          <p className="text-[14px] text-text-secondary">
            Showing <span className="font-semibold text-text-primary">{range.label}</span>
            {period === "ytd" ? " (year to date)" : ""} · {range.monthsWithData.length} of {range.monthsInRange.length} months saved
            {comparison?.summary ? ` · compared with ${comparison.label}` : ""}
            {comparison?.skipped ? ` · not compared with the year before: ${comparison.skipped}` : ""}
          </p>
          {range.missingMonths.length > 0 && (
            <p className="text-[13px] text-text-muted" data-testid="pl-missing">
              Not saved: {listMonths(range.missingMonths)} — not included in the totals.
            </p>
          )}
          {monthly.futureMonths.length > 0 && (
            <p className="text-[13px] text-text-muted">
              Left out because dated in the future: {listMonths(monthly.futureMonths)}.
            </p>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {kpis.map((kpi) => {
            const isNegative = kpi.isNetProfit && (kpi.value ?? 0) < 0;

            return (
              <div
                key={kpi.label}
                className="bg-surface rounded-xl p-lg border border-border-light shadow-card hover:shadow-medium transition-shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${kpi.iconColor}12`,
                    }}
                  >
                    <Icon
                      icon={kpi.icon}
                      className="w-5 h-5"
                      style={{ color: kpi.iconColor }}
                    />
                  </div>
                  <span className="text-[12px] flex flex-col items-end leading-tight">
                    <ChangeBadge change={kpi.change} higherIsBetter={kpi.higherIsBetter} />
                    {comparison?.summary && kpi.change !== null && (
                      <span className="text-[11px] text-text-muted">vs {comparison.label}</span>
                    )}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                  {kpi.label}
                  {kpi.tooltip && <InfoTooltip text={kpi.tooltip} />}
                </p>
                <p
                  className={`text-[24px] font-semibold tracking-tight tabular-nums ${
                    isNegative ? "text-error" : "text-text-primary"
                  }`}
                >
                  {formatCurrency(kpi.value)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Income vs Expenses Bar Chart */}
        <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
          <div className="mb-md">
            <h2 className="text-[20px] font-semibold text-text-primary">
              Income vs Expenses
            </h2>
            <p className="text-[13px] text-text-muted mt-0.5">Each month of {range.label}. Gaps are months with nothing saved.</p>
          </div>
          {chartHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8B8B8B" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8B8B8B" }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => (value == null ? "Not saved" : formatCurrency(Number(value)))}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E4E4E7",
                    boxShadow: "0 4px 16px -4px rgba(0,0,0,0.1)",
                    fontSize: "13px",
                    padding: "8px 12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar dataKey="Income" fill="#E65100" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="#5B21B6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-72 text-text-muted text-[14px]">
              No data for this period
            </div>
          )}
        </div>

        {/* P&L Summary Table */}
        <LockedFeature locked={trialMode} feature="P&L report" className="rounded-xl">
        <div className="bg-surface rounded-xl border border-border-light shadow-card overflow-hidden">
          <div className="px-lg py-md border-b border-border">
            <h2 className="text-[20px] font-semibold text-text-primary">
              P&L Summary{tableMonth ? ` — ${monthLabel(tableMonth)}` : ""}
            </h2>
            <p className="text-[13px] text-text-muted">Your latest saved month, compared with the same month last year and the month before.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                    Metric
                  </th>
                  <th className="text-right py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                    {tableMonth ? monthLabel(tableMonth, "short") : "Current"}
                  </th>
                  <th className="text-right py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">
                    {tableMonth ? monthLabel(addMonths(tableMonth, -12), "short") : "Prior Year"}
                  </th>
                  <th className="text-right py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">
                    Variance
                  </th>
                  <th className="text-right py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                    {tableMonth ? monthLabel(addMonths(tableMonth, -1), "short") : "Prior Month"}
                  </th>
                  <th className="text-right py-2.5 px-lg text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const fmt = row.isMargin ? formatPct : formatCurrency;
                  const isBold =
                    row.label === "Income" ||
                    row.label === "Net Profit" ||
                    row.label === "Total Expenses";

                  return (
                    <tr
                      key={row.label}
                      className={`border-b border-border-light last:border-b-0 hover:bg-surface-inset/50 transition-colors ${
                        isBold ? "bg-surface-inset/30" : ""
                      }`}
                    >
                      <td
                        className={`py-3 px-lg text-text-primary ${
                          isBold ? "font-semibold" : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {row.label}
                          {row.tooltip && <InfoTooltip text={row.tooltip} />}
                        </span>
                      </td>
                      <td className="text-right py-3 px-lg tabular-nums text-text-primary">
                        {fmt(row.current)}
                      </td>
                      <td className="text-right py-3 px-lg tabular-nums text-text-secondary hidden md:table-cell">
                        {fmt(row.priorYear)}
                      </td>
                      <td className="text-right py-3 px-lg tabular-nums hidden md:table-cell">
                        <VarianceCell value={row.pyVariance} isMargin={row.isMargin} higherIsBetter={row.higherIsBetter} />
                      </td>
                      <td className="text-right py-3 px-lg tabular-nums text-text-secondary">
                        {fmt(row.priorMonth)}
                      </td>
                      <td className="text-right py-3 px-lg tabular-nums">
                        <VarianceCell value={row.pmVariance} isMargin={row.isMargin} higherIsBetter={row.higherIsBetter} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </LockedFeature>
      </div>
    </AppLayout>
  );
}

// ─── Variance Cell ────────────────────────────────────────────────────────────

function VarianceCell({
  value,
  isMargin,
  higherIsBetter,
}: {
  value: number | null;
  isMargin: boolean;
  higherIsBetter: boolean;
}) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const tone = changeTone(value, higherIsBetter);
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-text-muted";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "";
  const display = isMargin
    ? `${Math.abs(value).toFixed(1)} pp`
    : `${Math.abs(value).toFixed(1)}%`;

  return (
    <span className={`font-medium ${color}`}>
      {arrow} {display}
    </span>
  );
}
