"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { FinancialSnapshot } from "@/lib/database.types";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRatio(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}${suffix}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatPeriodLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface KPICardProps {
  label: string;
  value: string;
  change: number | null;
  changeLabel: string;
  isHealthy: boolean;
  icon: string;
  delay: string;
}

function KPICard({ label, value, change, changeLabel, isHealthy, icon, delay }: KPICardProps) {
  const hasChange = change !== null && !isNaN(change);
  const isPositive = hasChange && change >= 0;

  return (
    <div
      className="group bg-surface rounded-xl p-lg border border-background shadow-sm hover:shadow-xl hover:border-orange/20 transition-all duration-300 animate-fadeIn"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-md">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${isHealthy ? "#10b981" : "#f59e0b"}15, ${isHealthy ? "#10b981" : "#f59e0b"}05)` }}
        >
          <Icon
            icon={icon}
            className="w-6 h-6"
            style={{ color: isHealthy ? "#10b981" : "#f59e0b" }}
          />
        </div>
        <div
          className={`w-3 h-3 rounded-full ${isHealthy ? "bg-success" : "bg-warning"}`}
        />
      </div>

      <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-sm">
        {label}
      </h3>

      <p className="font-display text-h1 md:text-[36px] text-text-primary mb-xs tracking-tight tabular-nums">
        {value}
      </p>

      <div className="flex items-center gap-xs text-small">
        {hasChange ? (
          <>
            <span className={isPositive ? "text-success" : "text-error"}>
              {isPositive ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-text-muted">{changeLabel}</span>
          </>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>
    </div>
  );
}

interface TableRowData {
  label: string;
  current: number | null;
  priorYear: number | null;
  isBold?: boolean;
}

function SummaryTable({ rows, delay }: { rows: TableRowData[]; delay: string }) {
  return (
    <div
      className="bg-surface rounded-xl border border-background shadow-sm overflow-hidden animate-fadeIn"
      style={{ animationDelay: delay }}
    >
      <div className="px-lg py-md border-b border-background">
        <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted">
          Balance Sheet Summary
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-background">
              <th className="text-left px-lg py-sm text-small font-semibold text-text-secondary">
                Account
              </th>
              <th className="text-right px-lg py-sm text-small font-semibold text-text-secondary">
                Current Period
              </th>
              <th className="text-right px-lg py-sm text-small font-semibold text-text-secondary">
                Prior Year
              </th>
              <th className="text-right px-lg py-sm text-small font-semibold text-text-secondary">
                Variance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const variance =
                row.current !== null && row.priorYear !== null
                  ? ((row.current - row.priorYear) / Math.abs(row.priorYear || 1)) * 100
                  : null;
              const isPositive = variance !== null && variance >= 0;

              return (
                <tr
                  key={row.label}
                  className={`border-b border-background last:border-b-0 ${
                    row.isBold ? "bg-background/50" : ""
                  }`}
                >
                  <td
                    className={`px-lg py-sm text-body ${
                      row.isBold ? "font-semibold text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {row.label}
                  </td>
                  <td
                    className={`text-right px-lg py-sm text-body tabular-nums ${
                      row.isBold ? "font-semibold text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {formatCurrency(row.current)}
                  </td>
                  <td className="text-right px-lg py-sm text-body text-text-muted tabular-nums">
                    {formatCurrency(row.priorYear)}
                  </td>
                  <td className="text-right px-lg py-sm text-body tabular-nums">
                    {variance !== null ? (
                      <span className={isPositive ? "text-success" : "text-error"}>
                        {isPositive ? "▲" : "▼"} {Math.abs(variance).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);

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

        if (error) {
          console.error("Error fetching snapshots:", error);
          setSnapshots([]);
        } else {
          setSnapshots(data || []);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching snapshots:", error);
        setSnapshots([]);
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, [user]);

  const currentSnapshot = snapshots[selectedPeriodIndex] || null;

  // Find prior year snapshot (12 months back)
  const priorYearSnapshot = useMemo(() => {
    if (!currentSnapshot) return null;
    const currentDate = new Date(currentSnapshot.period_date);
    const priorYearDate = new Date(currentDate);
    priorYearDate.setFullYear(priorYearDate.getFullYear() - 1);

    return (
      snapshots.find((s) => {
        const sDate = new Date(s.period_date);
        return (
          sDate.getMonth() === priorYearDate.getMonth() &&
          sDate.getFullYear() === priorYearDate.getFullYear()
        );
      }) || null
    );
  }, [currentSnapshot, snapshots]);

  // Find prior period snapshot (previous month)
  const priorPeriodSnapshot = snapshots[selectedPeriodIndex + 1] || null;

  // Compute KPI changes
  const computeChange = (
    current: number | null,
    prior: number | null
  ): number | null => {
    if (current === null || prior === null || prior === 0) return null;
    return ((current - prior) / Math.abs(prior)) * 100;
  };

  // Chart data (reversed for chronological order)
  const chartData = useMemo(() => {
    return [...snapshots]
      .reverse()
      .slice(-12)
      .map((s) => ({
        month: formatMonthLabel(s.period_date),
        currentRatio: s.current_ratio ?? 0,
        workingCapital: s.working_capital ?? 0,
      }));
  }, [snapshots]);

  // Table rows
  const tableRows: TableRowData[] = useMemo(() => {
    const totalLiabilities =
      (currentSnapshot?.current_liabilities ?? 0) +
      (currentSnapshot?.long_term_liabilities ?? 0);
    const priorTotalLiabilities =
      (priorYearSnapshot?.current_liabilities ?? 0) +
      (priorYearSnapshot?.long_term_liabilities ?? 0);

    return [
      {
        label: "Current Assets",
        current: currentSnapshot?.current_assets ?? null,
        priorYear: priorYearSnapshot?.current_assets ?? null,
      },
      {
        label: "Fixed Assets",
        current: currentSnapshot?.fixed_assets ?? null,
        priorYear: priorYearSnapshot?.fixed_assets ?? null,
      },
      {
        label: "Total Assets",
        current: currentSnapshot?.total_assets ?? null,
        priorYear: priorYearSnapshot?.total_assets ?? null,
        isBold: true,
      },
      {
        label: "Current Liabilities",
        current: currentSnapshot?.current_liabilities ?? null,
        priorYear: priorYearSnapshot?.current_liabilities ?? null,
      },
      {
        label: "Long-term Liabilities",
        current: currentSnapshot?.long_term_liabilities ?? null,
        priorYear: priorYearSnapshot?.long_term_liabilities ?? null,
      },
      {
        label: "Total Liabilities",
        current: totalLiabilities || null,
        priorYear: priorTotalLiabilities || null,
        isBold: true,
      },
      {
        label: "Equity",
        current: currentSnapshot?.equity ?? null,
        priorYear: priorYearSnapshot?.equity ?? null,
        isBold: true,
      },
    ];
  }, [currentSnapshot, priorYearSnapshot]);

  // Loading state
  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-2xl">
          <div className="animate-pulse space-y-lg">
            <div className="h-10 bg-background rounded-lg w-48" />
            <div className="grid gap-md md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 bg-background rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-background rounded-xl" />
          </div>
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
            Balance Sheet
          </h1>

          <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-background rounded-xl p-2xl border-2 border-orange shadow-lg">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10 max-w-lg mx-auto text-center space-y-lg py-xl">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-orange/10 rounded-full">
                <Icon icon="ph:scales-bold" className="w-12 h-12 text-orange" />
              </div>

              <div className="space-y-sm">
                <h2 className="font-display text-[28px] leading-tight text-text-primary">
                  No balance sheet data yet
                </h2>
                <p className="text-[15px] leading-relaxed text-text-secondary max-w-md mx-auto">
                  Connect QuickBooks or upload a spreadsheet to see your balance sheet analysis.
                </p>
              </div>

              <div className="pt-md">
                <a
                  href="/data"
                  className="inline-flex items-center gap-2 px-xl py-md bg-gradient-to-r from-orange to-orange-light text-white text-body font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Icon icon="ph:database-bold" className="w-5 h-5" />
                  Connect Your Data
                </a>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.6s ease-out forwards;
            opacity: 0;
          }
        `}</style>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-2xl">
        {/* Page Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md animate-fadeIn"
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-display text-[42px] md:text-[56px] leading-tight text-text-primary tracking-tight">
            Balance Sheet
          </h1>

          {/* Period Selector */}
          <div className="relative">
            <select
              value={selectedPeriodIndex}
              onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
              className="appearance-none bg-surface border border-border rounded-xl px-lg py-sm pr-xl text-body text-text-primary cursor-pointer hover:border-orange/50 focus:outline-none focus:border-orange transition-colors"
            >
              {snapshots.map((snapshot, idx) => (
                <option key={snapshot.id} value={idx}>
                  {formatPeriodLabel(snapshot.period_date)}
                </option>
              ))}
            </select>
            <Icon
              icon="ph:caret-down-bold"
              className="absolute right-md top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-md md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            label="Current Ratio"
            value={formatRatio(currentSnapshot?.current_ratio)}
            change={computeChange(currentSnapshot?.current_ratio, priorPeriodSnapshot?.current_ratio)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.current_ratio ?? 0) >= 2}
            icon="ph:scales-bold"
            delay="100ms"
          />
          <KPICard
            label="Working Capital"
            value={formatCurrency(currentSnapshot?.working_capital)}
            change={computeChange(currentSnapshot?.working_capital, priorPeriodSnapshot?.working_capital)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.working_capital ?? 0) > 0}
            icon="ph:wallet-bold"
            delay="200ms"
          />
          <KPICard
            label="ROA"
            value={formatPercent(currentSnapshot?.roa)}
            change={computeChange(currentSnapshot?.roa, priorPeriodSnapshot?.roa)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.roa ?? 0) > 5}
            icon="ph:chart-pie-bold"
            delay="300ms"
          />
          <KPICard
            label="ROE"
            value={formatPercent(currentSnapshot?.roe)}
            change={computeChange(currentSnapshot?.roe, priorPeriodSnapshot?.roe)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.roe ?? 0) > 10}
            icon="ph:trend-up-bold"
            delay="400ms"
          />
        </div>

        {/* Summary Table */}
        <SummaryTable rows={tableRows} delay="500ms" />

        {/* Charts Grid */}
        <div className="grid gap-md lg:grid-cols-2">
          {/* Current Ratio Trend Line Chart */}
          <div
            className="bg-surface rounded-xl border border-background shadow-sm p-lg animate-fadeIn"
            style={{ animationDelay: "600ms" }}
          >
            <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-md">
              Current Ratio Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#a3a3a3" }}
                    axisLine={{ stroke: "#e5e5e5" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#a3a3a3" }}
                    axisLine={{ stroke: "#e5e5e5" }}
                    tickLine={false}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e5e5",
                      borderRadius: "10px",
                      boxShadow: "0 4px 16px -4px rgba(0, 0, 0, 0.1)",
                    }}
                    labelStyle={{ color: "#1a1a1a", fontWeight: 600 }}
                    formatter={(value) => [Number(value).toFixed(2), "Current Ratio"]}
                  />
                  <ReferenceLine
                    y={2}
                    stroke="#10b981"
                    strokeDasharray="5 5"
                    label={{
                      value: "Healthy threshold (2.0)",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#10b981",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="currentRatio"
                    stroke="#E65100"
                    strokeWidth={3}
                    dot={{ fill: "#E65100", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "#E65100" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Working Capital Trend Bar Chart */}
          <div
            className="bg-surface rounded-xl border border-background shadow-sm p-lg animate-fadeIn"
            style={{ animationDelay: "700ms" }}
          >
            <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-md">
              Working Capital Trend
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#a3a3a3" }}
                    axisLine={{ stroke: "#e5e5e5" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#a3a3a3" }}
                    axisLine={{ stroke: "#e5e5e5" }}
                    tickLine={false}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("en-US", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(value)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e5e5",
                      borderRadius: "10px",
                      boxShadow: "0 4px 16px -4px rgba(0, 0, 0, 0.1)",
                    }}
                    labelStyle={{ color: "#1a1a1a", fontWeight: 600 }}
                    formatter={(value) => [formatCurrency(Number(value)), "Working Capital"]}
                  />
                  <Bar dataKey="workingCapital" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.workingCapital >= 0 ? "#E65100" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </AppLayout>
  );
}
