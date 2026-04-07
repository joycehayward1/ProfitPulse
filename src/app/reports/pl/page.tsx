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

type PeriodOption = "1" | "3" | "6" | "12";

const PERIOD_LABELS: Record<PeriodOption, string> = {
  "1": "Last Month",
  "3": "Last 3 Months",
  "6": "Last 6 Months",
  "12": "Last 12 Months",
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function pctChange(
  current: number | null | undefined,
  prior: number | null | undefined
): number | null {
  const c = current ?? 0;
  const p = prior ?? 0;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PLPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { subscription } = useAuth();
  const trialMode = isInTrial(subscription);
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodOption>("3");
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

  // Filter snapshots by selected period
  const filtered = useMemo(() => {
    if (snapshots.length === 0) return [];
    const months = parseInt(period);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return snapshots
      .filter((s) => new Date(s.period_date) >= cutoff)
      .sort(
        (a, b) =>
          new Date(a.period_date).getTime() - new Date(b.period_date).getTime()
      );
  }, [snapshots, period]);

  // Current = most recent snapshot, prior period = the one before it, prior year = 12 months back
  const current = snapshots[0] ?? null;
  const priorMonth = snapshots[1] ?? null;
  const priorYear = useMemo(() => {
    if (!current) return null;
    const targetDate = new Date(current.period_date + "T00:00:00");
    targetDate.setFullYear(targetDate.getFullYear() - 1);
    const targetStr = targetDate.toISOString().slice(0, 7); // YYYY-MM
    return (
      snapshots.find((s) => s.period_date.startsWith(targetStr)) ?? null
    );
  }, [snapshots, current]);

  // KPI cards data
  const kpis = useMemo(() => {
    const c = current;
    const pm = priorMonth;
    return [
      {
        label: "Total Income",
        value: c?.total_income ?? 0,
        change: pctChange(c?.total_income, pm?.total_income),
        icon: "ph:arrow-circle-down-bold",
        iconColor: "#43A047",
        tooltip: "All revenue your business earned before any expenses are deducted.",
      },
      {
        label: "Gross Profit",
        value: c?.gross_profit ?? 0,
        change: pctChange(c?.gross_profit, pm?.gross_profit),
        icon: "ph:trend-up-bold",
        iconColor: "#E65100",
        tooltip: "Revenue minus the direct costs of delivering your services or products.",
      },
      {
        label: "Total Expenses",
        value: c?.total_expenses ?? 0,
        change: pctChange(c?.total_expenses, pm?.total_expenses),
        icon: "ph:arrow-circle-up-bold",
        iconColor: "#ef4444",
        invertColor: true, // lower is better
        tooltip: "All business costs including payroll, rent, software, marketing, and overhead.",
      },
      {
        label: "Net Profit",
        value: c?.net_profit ?? 0,
        change: pctChange(c?.net_profit, pm?.net_profit),
        icon: "ph:chart-line-bold",
        iconColor: "#7B1FA2",
        isNetProfit: true,
        tooltip: "The bottom line — what's left after all expenses. This is the true measure of profitability.",
      },
    ];
  }, [current, priorMonth]);

  // Chart data
  const chartData = useMemo(
    () =>
      filtered.map((s) => ({
        month: monthLabel(s.period_date),
        Income: s.total_income ?? 0,
        Expenses: s.total_expenses ?? 0,
      })),
    [filtered]
  );

  // P&L table rows
  const tableRows = useMemo(() => {
    const c = current;
    const py = priorYear;
    const pm = priorMonth;

    function row(
      label: string,
      getCurrent: number | null | undefined,
      getPY: number | null | undefined,
      getPM: number | null | undefined,
      isMargin = false
    ) {
      const cv = getCurrent ?? 0;
      const pyv = getPY ?? 0;
      const pmv = getPM ?? 0;
      const pyVar = isMargin ? cv - pyv : pctChange(getCurrent, getPY);
      const pmVar = isMargin ? cv - pmv : pctChange(getCurrent, getPM);
      return { label, current: cv, priorYear: pyv, pyVariance: pyVar, priorMonth: pmv, pmVariance: pmVar, isMargin };
    }

    return [
      { ...row("Income", c?.total_income, py?.total_income, pm?.total_income), tooltip: "All revenue your business earned before any expenses are deducted." },
      { ...row("Gross Profit", c?.gross_profit, py?.gross_profit, pm?.gross_profit), tooltip: "Revenue minus the direct costs of delivering your services or products." },
      { ...row("Gross Profit Margin %", c?.gross_profit_margin, py?.gross_profit_margin, pm?.gross_profit_margin, true), tooltip: "Gross profit as a percentage of revenue. Higher means you keep more of each dollar earned." },
      { ...row("Total Expenses", c?.total_expenses, py?.total_expenses, pm?.total_expenses), tooltip: "All business costs including payroll, rent, software, marketing, and overhead." },
      { ...row("Net Operating Income", c?.net_operating_income, py?.net_operating_income, pm?.net_operating_income), tooltip: "Profit from core business operations, before interest and taxes." },
      { ...row("Net Profit", c?.net_profit, py?.net_profit, pm?.net_profit), tooltip: "The bottom line — what's left after all expenses." },
      { ...row("Net Profit Margin %", c?.net_profit_margin, py?.net_profit_margin, pm?.net_profit_margin, true), tooltip: "Net profit as a percentage of revenue. Shows how much of each dollar you actually keep." },
    ];
  }, [current, priorYear, priorMonth]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-lg animate-pulse">
          <div className="h-10 w-48 bg-border-light rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-border-light rounded-xl" />
            ))}
          </div>
          <div className="h-72 bg-border-light rounded-xl" />
          <div className="h-64 bg-border-light rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  // Empty state
  if (snapshots.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-lg">
          <h1 className="font-display text-[36px] md:text-[42px] leading-tight text-text-primary tracking-tight">
            Profit &amp; Loss
          </h1>

          <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-background rounded-xl p-2xl border-2 border-orange shadow-lg">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10 max-w-lg mx-auto text-center space-y-lg py-xl">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-orange/10 rounded-full">
                <Icon icon="ph:chart-line-up-bold" className="w-12 h-12 text-orange" />
              </div>

              <div className="space-y-sm">
                <h2 className="font-display text-[28px] leading-tight text-text-primary">
                  No P&L data yet
                </h2>
                <p className="text-[15px] leading-relaxed text-text-secondary max-w-md mx-auto">
                  Upload a spreadsheet or enter data manually to see your Profit &amp; Loss report.
                </p>
              </div>

              <div className="pt-md">
                <Link
                  href="/data"
                  className="inline-flex items-center gap-2 px-xl py-md bg-gradient-to-r from-orange to-orange-light text-white text-body font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
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
      <div className="space-y-lg">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[36px] md:text-[42px] leading-tight text-text-primary tracking-tight">
              Profit &amp; Loss
            </h1>
            {current && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium leading-4 ${
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
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-md py-xs bg-surface border border-border rounded-xl text-body text-text-primary font-medium hover:border-orange/40 transition-colors"
            >
              {PERIOD_LABELS[period]}
              <Icon icon="ph:caret-down-bold" className="w-4 h-4 text-text-muted" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-border-light rounded-xl shadow-elevated overflow-hidden z-20 min-w-[180px]">
                {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setPeriod(key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-md py-xs text-body transition-colors ${
                      period === key
                        ? "bg-orange/5 text-orange font-semibold"
                        : "text-text-secondary hover:bg-black/[0.03]"
                    }`}
                  >
                    {PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {kpis.map((kpi) => {
            const isNegative = kpi.isNetProfit && kpi.value < 0;
            const changePositive =
              kpi.change !== null && (kpi.invertColor ? kpi.change < 0 : kpi.change > 0);
            const changeNegative =
              kpi.change !== null && (kpi.invertColor ? kpi.change > 0 : kpi.change < 0);

            return (
              <div
                key={kpi.label}
                className="bg-surface rounded-xl p-lg border border-border-light shadow-soft hover:shadow-medium hover:border-orange/20 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-sm">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${kpi.iconColor}15, ${kpi.iconColor}05)`,
                    }}
                  >
                    <Icon
                      icon={kpi.icon}
                      className="w-5 h-5"
                      style={{ color: kpi.iconColor }}
                    />
                  </div>
                  {kpi.change !== null && (
                    <span
                      className={`text-small font-semibold flex items-center gap-0.5 ${
                        changePositive
                          ? "text-success"
                          : changeNegative
                          ? "text-error"
                          : "text-text-muted"
                      }`}
                    >
                      {changePositive ? "▲" : changeNegative ? "▼" : ""}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-small text-text-muted uppercase tracking-wider mb-xs flex items-center gap-1.5">
                  {kpi.label}
                  {kpi.tooltip && <InfoTooltip text={kpi.tooltip} />}
                </p>
                <p
                  className={`font-display text-h2 md:text-h1 tracking-tight tabular-nums ${
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
        <div className="bg-surface rounded-xl p-lg border border-border-light shadow-soft">
          <h2 className="text-small font-semibold uppercase tracking-wider text-text-muted mb-md">
            Income vs Expenses
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} barGap={4} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#a3a3a3" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#a3a3a3" }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e5e5",
                    boxShadow: "0 4px 16px -4px rgba(0,0,0,0.1)",
                    fontSize: "13px",
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar dataKey="Income" fill="#E65100" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="#a3a3a3" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-72 text-text-muted text-body">
              No data for this period
            </div>
          )}
        </div>

        {/* P&L Summary Table */}
        <LockedFeature locked={trialMode} className="rounded-xl">
        <div className="bg-surface rounded-xl border border-border-light shadow-soft overflow-hidden">
          <div className="p-lg pb-0">
            <h2 className="text-small font-semibold uppercase tracking-wider text-text-muted mb-md">
              P&L Summary
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="text-left py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                    Metric
                  </th>
                  <th className="text-right py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                    Current
                  </th>
                  <th className="text-right py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">
                    Prior Year
                  </th>
                  <th className="text-right py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted hidden md:table-cell">
                    Variance
                  </th>
                  <th className="text-right py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                    Prior Month
                  </th>
                  <th className="text-right py-sm px-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => {
                  const fmt = row.isMargin ? formatPct : formatCurrency;
                  const isBold =
                    row.label === "Income" ||
                    row.label === "Net Profit" ||
                    row.label === "Total Expenses";

                  return (
                    <tr
                      key={row.label}
                      className={`border-b border-border-light last:border-b-0 ${
                        i % 2 === 0 ? "bg-white" : "bg-background/40"
                      }`}
                    >
                      <td
                        className={`py-sm px-lg text-text-primary ${
                          isBold ? "font-semibold" : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {row.label}
                          {row.tooltip && <InfoTooltip text={row.tooltip} />}
                        </span>
                      </td>
                      <td className="text-right py-sm px-lg tabular-nums text-text-primary">
                        {fmt(row.current)}
                      </td>
                      <td className="text-right py-sm px-lg tabular-nums text-text-secondary hidden md:table-cell">
                        {fmt(row.priorYear)}
                      </td>
                      <td className="text-right py-sm px-lg tabular-nums hidden md:table-cell">
                        <VarianceCell value={row.pyVariance} isMargin={row.isMargin} />
                      </td>
                      <td className="text-right py-sm px-lg tabular-nums text-text-secondary">
                        {fmt(row.priorMonth)}
                      </td>
                      <td className="text-right py-sm px-lg tabular-nums">
                        <VarianceCell value={row.pmVariance} isMargin={row.isMargin} />
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
}: {
  value: number | null;
  isMargin: boolean;
}) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const positive = value > 0;
  const negative = value < 0;
  const color = positive ? "text-success" : negative ? "text-error" : "text-text-muted";
  const arrow = positive ? "▲" : negative ? "▼" : "";
  const display = isMargin
    ? `${Math.abs(value).toFixed(1)} pp`
    : `${Math.abs(value).toFixed(1)}%`;

  return (
    <span className={`font-medium ${color}`}>
      {arrow} {display}
    </span>
  );
}
