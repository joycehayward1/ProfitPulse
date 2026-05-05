"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { InfoTooltip } from "@/components/ui/MetricTooltip";
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
  tooltip?: string;
}

function KPICard({ label, value, change, changeLabel, isHealthy, icon, tooltip }: KPICardProps) {
  const hasChange = change !== null && !isNaN(change);
  const isPositive = hasChange && change >= 0;

  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card hover:shadow-medium transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: isHealthy ? "#16A34A12" : "#E6510012" }}
        >
          <Icon
            icon={icon}
            className="w-5 h-5"
            style={{ color: isHealthy ? "#16A34A" : "#E65100" }}
          />
        </div>
        {hasChange ? (
          <span
            className={`text-[12px] font-medium inline-flex items-center gap-0.5 ${
              isPositive ? "text-success" : "text-error"
            }`}
          >
            {isPositive ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
          </span>
        ) : (
          <span className="text-text-muted text-[12px]">—</span>
        )}
      </div>

      <h3 className="text-[13px] font-medium text-text-secondary mb-1 flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h3>

      <p className="text-[24px] font-semibold text-text-primary tracking-tight tabular-nums">
        {value}
      </p>

      {hasChange && (
        <p className="text-[12px] text-text-muted mt-1">
          {changeLabel}
        </p>
      )}
    </div>
  );
}

interface TableRowData {
  label: string;
  current: number | null;
  priorYear: number | null;
  isBold?: boolean;
  tooltip?: string;
}

function SummaryTable({ rows }: { rows: TableRowData[] }) {
  return (
    <div className="bg-surface rounded-xl border border-border-light shadow-card overflow-hidden">
      <div className="px-lg py-md border-b border-border">
        <h3 className="text-[20px] font-semibold text-text-primary">
          Balance Sheet Summary
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-light">
              <th className="text-left px-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                Account
              </th>
              <th className="text-right px-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                Current Period
              </th>
              <th className="text-right px-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                Prior Year
              </th>
              <th className="text-right px-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                Variance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const variance =
                row.current !== null && row.priorYear !== null
                  ? ((row.current - row.priorYear) / Math.abs(row.priorYear || 1)) * 100
                  : null;
              const isPositive = variance !== null && variance >= 0;

              return (
                <tr
                  key={row.label}
                  className={`border-b border-border-light last:border-b-0 hover:bg-surface-inset/50 transition-colors ${
                    row.isBold ? "bg-surface-inset/30" : ""
                  }`}
                >
                  <td
                    className={`px-lg py-3 text-[14px] ${
                      row.isBold ? "font-semibold text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      {row.tooltip && <InfoTooltip text={row.tooltip} />}
                    </span>
                  </td>
                  <td
                    className={`text-right px-lg py-3 text-[14px] tabular-nums ${
                      row.isBold ? "font-semibold text-text-primary" : "text-text-secondary"
                    }`}
                  >
                    {formatCurrency(row.current)}
                  </td>
                  <td className="text-right px-lg py-3 text-[14px] text-text-muted tabular-nums">
                    {formatCurrency(row.priorYear)}
                  </td>
                  <td className="text-right px-lg py-3 text-[14px] tabular-nums">
                    {variance !== null ? (
                      <span className={`font-medium ${isPositive ? "text-success" : "text-error"}`}>
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
        tooltip: "Cash and assets that can be converted to cash within a year, like receivables and inventory.",
      },
      {
        label: "Fixed Assets",
        current: currentSnapshot?.fixed_assets ?? null,
        priorYear: priorYearSnapshot?.fixed_assets ?? null,
        tooltip: "Long-term assets like equipment, property, and vehicles used to run your business.",
      },
      {
        label: "Total Assets",
        current: currentSnapshot?.total_assets ?? null,
        priorYear: priorYearSnapshot?.total_assets ?? null,
        isBold: true,
        tooltip: "Everything your business owns — both current and fixed assets combined.",
      },
      {
        label: "Current Liabilities",
        current: currentSnapshot?.current_liabilities ?? null,
        priorYear: priorYearSnapshot?.current_liabilities ?? null,
        tooltip: "Debts and obligations due within the next 12 months, like accounts payable and short-term loans.",
      },
      {
        label: "Long-term Liabilities",
        current: currentSnapshot?.long_term_liabilities ?? null,
        priorYear: priorYearSnapshot?.long_term_liabilities ?? null,
        tooltip: "Debts due beyond 12 months, like long-term loans, mortgages, or leases.",
      },
      {
        label: "Total Liabilities",
        current: totalLiabilities || null,
        priorYear: priorTotalLiabilities || null,
        isBold: true,
        tooltip: "Everything your business owes — all current and long-term debts combined.",
      },
      {
        label: "Equity",
        current: currentSnapshot?.equity ?? null,
        priorYear: priorYearSnapshot?.equity ?? null,
        isBold: true,
        tooltip: "The owner's stake in the business — total assets minus total liabilities. This is your net worth.",
      },
    ];
  }, [currentSnapshot, priorYearSnapshot]);

  // Loading state
  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="space-y-xl">
          <div className="h-9 w-48 bg-surface-inset rounded-lg animate-pulse" />
          <div className="grid gap-md md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-surface-inset rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-surface-inset rounded-lg animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  // Empty state
  if (snapshots.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-xl">
          <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
            Balance Sheet
          </h1>

          <div className="bg-surface rounded-xl border border-border-light shadow-card p-2xl text-center">
            <div className="max-w-md mx-auto space-y-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange/[0.08] text-orange mx-auto">
                <Icon icon="ph:scales-bold" className="w-8 h-8" />
              </div>

              <div className="space-y-sm">
                <h2 className="text-[20px] font-semibold text-text-primary">
                  No balance sheet data yet
                </h2>
                <p className="text-[14px] text-text-secondary max-w-md mx-auto">
                  Upload a spreadsheet or enter data manually to see your balance sheet analysis.
                </p>
              </div>

              <div className="pt-sm">
                <a
                  href="/data"
                  className="inline-flex items-center gap-2 px-xl py-md bg-orange text-white text-[14px] font-semibold rounded-xl hover:bg-orange/90 transition-colors"
                >
                  <Icon icon="ph:database-bold" className="w-5 h-5" />
                  Connect Your Data
                </a>
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
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
              Balance Sheet
            </h1>
            {currentSnapshot && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  currentSnapshot.data_source === "quickbooks"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {currentSnapshot.data_source === "quickbooks" && (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
                {currentSnapshot.data_source === "quickbooks" ? "QuickBooks" : currentSnapshot.data_source === "spreadsheet" ? "Spreadsheet" : "Manual"}
              </span>
            )}
          </div>

          {/* Period Selector */}
          <div className="relative">
            <select
              value={selectedPeriodIndex}
              onChange={(e) => setSelectedPeriodIndex(Number(e.target.value))}
              className="h-9 px-3 pr-10 rounded-lg border border-border bg-surface text-[13px] text-text-primary appearance-none cursor-pointer hover:border-orange/40 focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-colors"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a3a3a3' viewBox='0 0 256 256'%3E%3Cpath d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
              }}
            >
              {snapshots.map((snapshot, idx) => (
                <option key={snapshot.id} value={idx}>
                  {formatPeriodLabel(snapshot.period_date)}
                </option>
              ))}
            </select>
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
            tooltip="Current assets divided by current liabilities. Above 2.0 means you can comfortably cover short-term debts."
          />
          <KPICard
            label="Working Capital"
            value={formatCurrency(currentSnapshot?.working_capital)}
            change={computeChange(currentSnapshot?.working_capital, priorPeriodSnapshot?.working_capital)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.working_capital ?? 0) > 0}
            icon="ph:wallet-bold"
            tooltip="Current assets minus current liabilities. Positive means you have enough to fund day-to-day operations."
          />
          <KPICard
            label="ROA"
            value={formatPercent(currentSnapshot?.roa)}
            change={computeChange(currentSnapshot?.roa, priorPeriodSnapshot?.roa)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.roa ?? 0) > 5}
            icon="ph:chart-pie-bold"
            tooltip="Return on Assets — how efficiently your business uses its assets to generate profit. Higher is better."
          />
          <KPICard
            label="ROE"
            value={formatPercent(currentSnapshot?.roe)}
            change={computeChange(currentSnapshot?.roe, priorPeriodSnapshot?.roe)}
            changeLabel="vs prior period"
            isHealthy={(currentSnapshot?.roe ?? 0) > 10}
            icon="ph:trend-up-bold"
            tooltip="Return on Equity — how much profit you generate for each dollar of owner's equity. Higher means better returns."
          />
        </div>

        {/* Summary Table */}
        <SummaryTable rows={tableRows} />

        {/* Charts Grid */}
        <div className="grid gap-md lg:grid-cols-2">
          {/* Current Ratio Trend Line Chart */}
          <div className="bg-surface rounded-xl border border-border-light shadow-card p-lg">
            <div className="mb-md">
              <h3 className="text-[20px] font-semibold text-text-primary">
                Current Ratio Trend
              </h3>
              <p className="text-[13px] text-text-muted mt-0.5">Last 12 periods</p>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#8B8B8B" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#8B8B8B" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E4E4E7",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px -4px rgba(0, 0, 0, 0.1)",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: "#111111", fontWeight: 600, fontSize: "13px" }}
                    formatter={(value) => [Number(value).toFixed(2), "Current Ratio"]}
                  />
                  <ReferenceLine
                    y={2}
                    stroke="#16A34A"
                    strokeDasharray="5 5"
                    label={{
                      value: "Healthy (2.0)",
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "#16A34A",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="currentRatio"
                    stroke="#E65100"
                    strokeWidth={2.5}
                    dot={{ fill: "#E65100", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: "#E65100" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Working Capital Trend Bar Chart */}
          <div className="bg-surface rounded-xl border border-border-light shadow-card p-lg">
            <div className="mb-md">
              <h3 className="text-[20px] font-semibold text-text-primary">
                Working Capital Trend
              </h3>
              <p className="text-[13px] text-text-muted mt-0.5">Last 12 periods</p>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#8B8B8B" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#8B8B8B" }}
                    axisLine={false}
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
                      border: "1px solid #E4E4E7",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px -4px rgba(0, 0, 0, 0.1)",
                      padding: "8px 12px",
                    }}
                    labelStyle={{ color: "#111111", fontWeight: 600, fontSize: "13px" }}
                    formatter={(value) => [formatCurrency(Number(value)), "Working Capital"]}
                  />
                  <Bar dataKey="workingCapital" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.workingCapital >= 0 ? "#E65100" : "#DC2626"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
