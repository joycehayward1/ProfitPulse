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
    return <span className="text-text-muted text-small">--</span>;
  }
  const diff = current - prior;
  const pct = prior !== 0 ? (diff / Math.abs(prior)) * 100 : current !== 0 ? 100 : 0;
  const isPositive = diff >= 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-small font-medium ${
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
    <div className="bg-surface border border-border rounded-lg shadow-elevated px-4 py-3">
      <p className="text-small text-text-muted mb-1">{data.payload.month}</p>
      <p
        className={`font-display text-h3 font-semibold ${
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
  delay: string;
  tooltip?: string;
}

function KpiCard({ label, icon, iconColor, value, priorValue, negative, delay, tooltip }: KpiCardProps) {
  const isNegative = negative && value < 0;

  return (
    <div
      className="group bg-surface rounded-xl p-lg border border-border-light shadow-soft hover:shadow-medium hover:border-orange/20 transition-all duration-300 animate-fadeIn"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between mb-md">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${iconColor}15, ${iconColor}05)` }}
        >
          <Icon icon={icon} className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <Variance current={value} prior={priorValue} />
      </div>

      <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-xs flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h3>

      <p
        className={`font-display text-h1 md:text-[36px] tracking-tight tabular-nums ${
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
      <div className="space-y-2xl">
        {/* Page Header */}
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md animate-fadeIn"
          style={{ animationDelay: "0ms" }}
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[28px] md:text-[36px] text-text-primary tracking-tight">
                Cash Flow
              </h1>
              {currentSnapshot && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium leading-4 ${
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
            <p className="text-body text-text-secondary mt-1">
              Where your money comes from and where it goes
            </p>
          </div>

          {!isLoading && snapshots.length > 0 && (
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-10 px-4 pr-10 rounded-lg border border-border bg-surface text-body text-text-primary font-body appearance-none cursor-pointer hover:border-orange/40 focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none transition-all duration-200"
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
          <div className="space-y-md animate-fadeIn" style={{ animationDelay: "100ms" }}>
            <div className="grid gap-md md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-xl p-lg border border-border-light animate-pulse">
                  <div className="w-10 h-10 bg-background rounded-full mb-md" />
                  <div className="w-20 h-4 bg-background rounded mb-sm" />
                  <div className="w-32 h-8 bg-background rounded" />
                </div>
              ))}
            </div>
            <div className="bg-surface rounded-xl p-lg border border-border-light h-[300px] animate-pulse">
              <div className="w-full h-full bg-background rounded" />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && snapshots.length === 0 && (
          <div className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-background rounded-xl p-2xl border-2 border-orange shadow-lg">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10 max-w-lg mx-auto text-center space-y-lg py-xl">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-orange/10 rounded-full">
                <Icon icon="ph:currency-circle-dollar-bold" className="w-12 h-12 text-orange" />
              </div>

              <div className="space-y-sm">
                <h2 className="font-display text-[28px] leading-tight text-text-primary">
                  No cash flow data yet
                </h2>
                <p className="text-[15px] leading-relaxed text-text-secondary max-w-md mx-auto">
                  Upload a spreadsheet or enter data manually to see your cash flow analysis.
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
                delay="200ms"
                tooltip="Cash generated from your core business operations — sales, services, and day-to-day activities."
              />
              <KpiCard
                label="Investing Activities"
                icon="ph:chart-pie-slice-bold"
                iconColor="#7B1FA2"
                value={safeNum(currentSnapshot.investing_activities)}
                priorValue={safeNum(priorMonthSnapshot?.investing_activities)}
                delay="300ms"
                tooltip="Cash spent on or received from long-term investments like equipment, property, or other assets."
              />
              <KpiCard
                label="Net Cash Flow"
                icon="ph:arrows-left-right-bold"
                iconColor={safeNum(currentSnapshot.net_cash_flow) >= 0 ? "#10b981" : "#ef4444"}
                value={safeNum(currentSnapshot.net_cash_flow)}
                priorValue={safeNum(priorMonthSnapshot?.net_cash_flow)}
                negative
                delay="400ms"
                tooltip="The total change in cash for the period. Positive means more cash came in than went out."
              />
            </div>

            {/* Trend Chart */}
            <div
              className="bg-surface rounded-xl p-lg border border-border-light shadow-soft animate-fadeIn"
              style={{ animationDelay: "500ms" }}
            >
              <div className="flex items-center justify-between mb-lg">
                <div>
                  <h2 className="font-display text-h3 text-text-primary">Net Cash Flow Trend</h2>
                  <p className="text-small text-text-muted mt-0.5">Monthly net cash flow over time</p>
                </div>
              </div>

              {chartData.length > 1 ? (
                <div className="h-[300px] sm:h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: "#a3a3a3" }}
                        axisLine={{ stroke: "#e5e5e5" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#a3a3a3" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatCompactCurrency(v)}
                        width={60}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="#a3a3a3" strokeDasharray="4 4" />
                      <defs>
                        <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E65100" stopOpacity={1} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                        </linearGradient>
                      </defs>
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
                  <p className="text-body text-text-muted">
                    Need at least two periods to display a trend
                  </p>
                </div>
              )}
            </div>

            {/* Summary Table */}
            <div
              className="bg-surface rounded-xl border border-border-light shadow-soft overflow-hidden animate-fadeIn"
              style={{ animationDelay: "600ms" }}
            >
              <div className="px-lg py-md border-b border-border-light">
                <h2 className="font-display text-h3 text-text-primary">Cash Flow Summary</h2>
                <p className="text-small text-text-muted mt-0.5">
                  {currentSnapshot ? formatPeriodLabel(currentSnapshot.period_date) : ""}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th className="text-left px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Category
                      </th>
                      <th className="text-right px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Current
                      </th>
                      <th className="text-right px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Prior Year
                      </th>
                      <th className="text-right px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Var
                      </th>
                      <th className="text-right px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Prior Month
                      </th>
                      <th className="text-right px-lg py-3 text-small font-semibold tracking-wider uppercase text-text-muted">
                        Var
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr
                        key={row.label}
                        className={`border-b border-border-light last:border-b-0 hover:bg-background/50 transition-colors ${
                          row.bold ? "bg-background/30" : ""
                        }`}
                      >
                        <td
                          className={`px-lg py-3.5 text-body ${
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
                          className={`text-right px-lg py-3.5 tabular-nums ${
                            row.bold
                              ? "font-display font-semibold text-text-primary"
                              : "font-body text-body text-text-primary"
                          } ${row.bold && row.current < 0 ? "text-error" : ""}`}
                        >
                          {formatCurrency(row.current)}
                        </td>
                        <td className="text-right px-lg py-3.5 font-body text-body text-text-secondary tabular-nums">
                          {priorYearSnapshot ? formatCurrency(row.priorYear) : "--"}
                        </td>
                        <td className="text-right px-lg py-3.5">
                          {priorYearSnapshot ? (
                            <Variance current={row.current} prior={row.priorYear} />
                          ) : (
                            <span className="text-text-muted text-small">--</span>
                          )}
                        </td>
                        <td className="text-right px-lg py-3.5 font-body text-body text-text-secondary tabular-nums">
                          {priorMonthSnapshot ? formatCurrency(row.priorMonth) : "--"}
                        </td>
                        <td className="text-right px-lg py-3.5">
                          {priorMonthSnapshot ? (
                            <Variance current={row.current} prior={row.priorMonth} />
                          ) : (
                            <span className="text-text-muted text-small">--</span>
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
