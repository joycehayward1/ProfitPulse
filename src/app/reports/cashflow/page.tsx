"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { InfoTooltip } from "@/components/ui/MetricTooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { FinancialSnapshot } from "@/lib/database.types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(value);
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatPeriodLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function safeNum(v: number | null | undefined): number {
  return v ?? 0;
}

// ─── Variance display ────────────────────────────────────────────────────────

interface VarianceProps {
  current: number;
  prior: number;
}

function Variance({ current, prior }: VarianceProps) {
  if (prior === 0 && current === 0) {
    return <span className="text-text-muted text-[12px]">--</span>;
  }
  const diff = current - prior;
  const pct = prior !== 0 ? (diff / Math.abs(prior)) * 100 : current !== 0 ? 100 : 0;
  const isPositive = diff >= 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] font-medium ${
        isPositive ? "text-success" : "text-error"
      }`}
    >
      {isPositive ? "\u25B2" : "\u25BC"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Period selector options ─────────────────────────────────────────────────

function buildPeriodOptions(snapshots: FinancialSnapshot[]): string[] {
  return snapshots.map((s) => s.period_date);
}

// ─── Custom recharts tooltip ─────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  payload: { month: string; net_cash_flow: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  return (
    <div className="bg-white border border-border rounded-lg shadow-elevated px-3 py-2">
      <p className="text-[12px] text-text-muted mb-1">{data.payload.month}</p>
      <p
        className={`text-[14px] font-semibold ${
          data.value >= 0 ? "text-orange" : "text-error"
        }`}
      >
        {formatCurrency(data.value)}
      </p>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  icon: string;
  iconColor: string;
  value: number;
  priorValue: number;
  negative?: boolean;
  tooltip?: string;
}

function KpiCard({ label, icon, iconColor, value, priorValue, negative, tooltip }: KpiCardProps) {
  const isNegative = negative && value < 0;

  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card hover:shadow-medium transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${iconColor}12` }}
        >
          <Icon icon={icon} className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <Variance current={value} prior={priorValue} />
      </div>

      <h3 className="text-[13px] font-medium text-text-secondary mb-1 flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h3>

      <p
        className={`text-[24px] font-semibold tracking-tight tabular-nums ${
          isNegative ? "text-error" : "text-text-primary"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  // Fetch snapshots
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

        if (error || !data) {
          setSnapshots([]);
        } else {
          setSnapshots(data as FinancialSnapshot[]);
          if (data.length > 0) {
            setSelectedPeriod(data[0].period_date);
          }
        }
      } catch (err) {
        console.error("Error fetching snapshots:", err);
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSnapshots();
  }, [user]);

  // Derived data
  const currentSnapshot = useMemo(
    () => snapshots.find((s) => s.period_date === selectedPeriod) ?? null,
    [snapshots, selectedPeriod]
  );

  const priorMonthSnapshot = useMemo(() => {
    if (!currentSnapshot) return null;
    const idx = snapshots.findIndex((s) => s.period_date === selectedPeriod);
    return idx >= 0 && idx + 1 < snapshots.length ? snapshots[idx + 1] : null;
  }, [snapshots, selectedPeriod, currentSnapshot]);

  const priorYearSnapshot = useMemo(() => {
    if (!currentSnapshot) return null;
    const currentDate = new Date(selectedPeriod + "T00:00:00");
    const priorYearDate = new Date(currentDate);
    priorYearDate.setFullYear(priorYearDate.getFullYear() - 1);
    const priorYearStr = priorYearDate.toISOString().slice(0, 10);
    return snapshots.find((s) => s.period_date === priorYearStr) ?? null;
  }, [snapshots, selectedPeriod, currentSnapshot]);

  // Chart data — chronological order (oldest → newest)
  const chartData = useMemo(() => {
    return [...snapshots]
      .reverse()
      .map((s) => ({
        month: formatMonthLabel(s.period_date),
        net_cash_flow: safeNum(s.net_cash_flow),
      }));
  }, [snapshots]);

  const periodOptions = useMemo(() => buildPeriodOptions(snapshots), [snapshots]);

  // Summary table rows
  const summaryRows = useMemo(() => {
    const c = currentSnapshot;
    const py = priorYearSnapshot;
    const pm = priorMonthSnapshot;

    return [
      {
        label: "Operating Activities",
        current: safeNum(c?.operating_activities),
        priorYear: safeNum(py?.operating_activities),
        priorMonth: safeNum(pm?.operating_activities),
        bold: false,
        tooltip: "Cash generated from your core business operations — sales, services, and day-to-day activities.",
      },
      {
        label: "Investing Activities",
        current: safeNum(c?.investing_activities),
        priorYear: safeNum(py?.investing_activities),
        priorMonth: safeNum(pm?.investing_activities),
        bold: false,
        tooltip: "Cash spent on or received from long-term investments like equipment, property, or other assets.",
      },
      {
        label: "Financing Activities",
        current: safeNum(c?.financing_activities),
        priorYear: safeNum(py?.financing_activities),
        priorMonth: safeNum(pm?.financing_activities),
        bold: false,
        tooltip: "Cash from loans, investor funding, or repayments. Includes debt and equity transactions.",
      },
      {
        label: "Net Cash Flow",
        current: safeNum(c?.net_cash_flow),
        priorYear: safeNum(py?.net_cash_flow),
        priorMonth: safeNum(pm?.net_cash_flow),
        bold: true,
        tooltip: "The total change in cash for the period. Positive means more cash came in than went out.",
      },
    ];
  }, [currentSnapshot, priorYearSnapshot, priorMonthSnapshot]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isLoading = authLoading || loading;

  return (
    <AppLayout>
      <div className="space-y-xl">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
                Cash Flow
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
            <p className="text-[14px] text-text-muted mt-1">
              Where your money comes from and where it goes
            </p>
          </div>

          {!isLoading && snapshots.length > 0 && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 px-3 pr-10 rounded-lg border border-border bg-surface text-[13px] text-text-primary appearance-none cursor-pointer hover:border-orange/40 focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-colors"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a3a3a3' viewBox='0 0 256 256'%3E%3Cpath d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
              }}
            >
              {periodOptions.map((pd) => (
                <option key={pd} value={pd}>
                  {formatPeriodLabel(pd)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-xl">
            <div className="grid gap-md md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-inset rounded-lg h-32 animate-pulse" />
              ))}
            </div>
            <div className="bg-surface-inset rounded-lg h-[300px] animate-pulse" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && snapshots.length === 0 && (
          <div className="bg-surface rounded-xl border border-border-light shadow-card p-2xl text-center">
            <div className="max-w-md mx-auto space-y-lg">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange/[0.08] text-orange mx-auto">
                <Icon icon="ph:currency-circle-dollar-bold" className="w-8 h-8" />
              </div>

              <div className="space-y-sm">
                <h2 className="text-[20px] font-semibold text-text-primary">
                  No cash flow data yet
                </h2>
                <p className="text-[14px] text-text-secondary max-w-md mx-auto">
                  Upload a spreadsheet or enter data manually to see your cash flow analysis.
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
        )}

        {/* Data present */}
        {!isLoading && currentSnapshot && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-md md:grid-cols-3">
              <KpiCard
                label="Operating Activities"
                icon="ph:buildings-bold"
                iconColor="#E65100"
                value={safeNum(currentSnapshot.operating_activities)}
                priorValue={safeNum(priorMonthSnapshot?.operating_activities)}
                tooltip="Cash generated from your core business operations — sales, services, and day-to-day activities."
              />
              <KpiCard
                label="Investing Activities"
                icon="ph:chart-pie-slice-bold"
                iconColor="#7B1FA2"
                value={safeNum(currentSnapshot.investing_activities)}
                priorValue={safeNum(priorMonthSnapshot?.investing_activities)}
                tooltip="Cash spent on or received from long-term investments like equipment, property, or other assets."
              />
              <KpiCard
                label="Net Cash Flow"
                icon="ph:arrows-left-right-bold"
                iconColor={safeNum(currentSnapshot.net_cash_flow) >= 0 ? "#16A34A" : "#DC2626"}
                value={safeNum(currentSnapshot.net_cash_flow)}
                priorValue={safeNum(priorMonthSnapshot?.net_cash_flow)}
                negative
                tooltip="The total change in cash for the period. Positive means more cash came in than went out."
              />
            </div>

            {/* Trend Chart */}
            <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
              <div className="mb-md">
                <h2 className="text-[20px] font-semibold text-text-primary">Net Cash Flow Trend</h2>
                <p className="text-[13px] text-text-muted mt-0.5">Monthly net cash flow over time</p>
              </div>

              {chartData.length > 1 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                        tickFormatter={(v: number) => formatCompactCurrency(v)}
                        width={60}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="#8B8B8B" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="net_cash_flow"
                        stroke="#E65100"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#E65100", stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: "#E65100", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-[14px] text-text-muted">
                    Need at least two periods to display a trend
                  </p>
                </div>
              )}
            </div>

            {/* Summary Table */}
            <div className="bg-surface rounded-xl border border-border-light shadow-card overflow-hidden">
              <div className="px-lg py-md border-b border-border">
                <h2 className="text-[20px] font-semibold text-text-primary">Cash Flow Summary</h2>
                <p className="text-[13px] text-text-muted mt-0.5">
                  {currentSnapshot ? formatPeriodLabel(currentSnapshot.period_date) : ""}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Category
                      </th>
                      <th className="text-right px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Current
                      </th>
                      <th className="text-right px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Prior Year
                      </th>
                      <th className="text-right px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Var
                      </th>
                      <th className="text-right px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Prior Month
                      </th>
                      <th className="text-right px-lg py-2.5 text-[12px] font-semibold tracking-wider uppercase text-text-muted">
                        Var
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr
                        key={row.label}
                        className={`border-b border-border-light last:border-b-0 hover:bg-surface-inset/50 transition-colors ${
                          row.bold ? "bg-surface-inset/30" : ""
                        }`}
                      >
                        <td
                          className={`px-lg py-3 text-[14px] ${
                            row.bold
                              ? "font-semibold text-text-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {row.label}
                            {row.tooltip && <InfoTooltip text={row.tooltip} />}
                          </span>
                        </td>
                        <td
                          className={`text-right px-lg py-3 tabular-nums text-[14px] ${
                            row.bold
                              ? "font-semibold text-text-primary"
                              : "text-text-primary"
                          } ${row.bold && row.current < 0 ? "text-error" : ""}`}
                        >
                          {formatCurrency(row.current)}
                        </td>
                        <td className="text-right px-lg py-3 text-[14px] text-text-secondary tabular-nums">
                          {priorYearSnapshot ? formatCurrency(row.priorYear) : "--"}
                        </td>
                        <td className="text-right px-lg py-3">
                          {priorYearSnapshot ? (
                            <Variance current={row.current} prior={row.priorYear} />
                          ) : (
                            <span className="text-text-muted text-[12px]">--</span>
                          )}
                        </td>
                        <td className="text-right px-lg py-3 text-[14px] text-text-secondary tabular-nums">
                          {priorMonthSnapshot ? formatCurrency(row.priorMonth) : "--"}
                        </td>
                        <td className="text-right px-lg py-3">
                          {priorMonthSnapshot ? (
                            <Variance current={row.current} prior={row.priorMonth} />
                          ) : (
                            <span className="text-text-muted text-[12px]">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
