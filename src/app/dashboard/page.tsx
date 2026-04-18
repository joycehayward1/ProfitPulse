"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { TrafficLightDot } from "@/components/ui/TrafficLightDot";
import type { HealthStatus } from "@/components/ui/TrafficLightDot";
import { calculateHealthScore, getHealthStatus } from "@/lib/healthScore";
import type { HealthAssessment, FinancialSnapshot } from "@/lib/database.types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { isInTrial } from "@/lib/feature-gate";
import { LockedFeature } from "@/components/LockedFeature";
import { InfoTooltip } from "@/components/ui/MetricTooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getFormattedDate(): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRunway(cash: number, expenses: number): string {
  if (expenses <= 0) return "∞ months";
  const months = Math.floor(cash / expenses);
  return `${months} month${months !== 1 ? "s" : ""}`;
}

function getRunwayStatus(cash: number, expenses: number): string {
  if (expenses <= 0) return "Excellent";
  const months = cash / expenses;
  if (months >= 6) return "Excellent";
  if (months >= 3) return "Healthy";
  if (months >= 1) return "Needs Attention";
  return "Critical";
}

function getRunwayHealthStatus(cash: number, expenses: number): HealthStatus {
  if (expenses <= 0) return "healthy";
  const months = cash / expenses;
  if (months >= 3) return "healthy";
  if (months >= 1) return "attention";
  return "critical";
}

interface AnimatedCurrencyProps {
  value: number;
  className?: string;
  delay?: number;
}

function AnimatedCurrency({ value, className = "", delay = 0 }: AnimatedCurrencyProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let currentStep = 0;

    const startAnimation = () => {
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(increment * currentStep));
        }
      }, duration / steps);

      return timer;
    };

    const timeoutId = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return <span className={className}>{formatCurrency(count)}</span>;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  statusText: string;
  status: HealthStatus;
  delay: string;
  icon: string;
  iconColor: string;
  /** If true, formats value as currency and animates the count-up */
  animateCurrency?: boolean;
  /** If true, animates the numeric value */
  animateNumber?: boolean;
  /** Tooltip text explaining the metric */
  tooltip?: string;
}

function MetricCard({
  label,
  value,
  statusText,
  status,
  delay,
  icon,
  iconColor,
  animateCurrency = false,
  animateNumber = false,
  tooltip,
}: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : 0;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!animateCurrency && !animateNumber) {
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = numericValue / steps;
    let currentStep = 0;

    // Parse delay for staggered animation
    const delayMs = parseInt(delay) || 0;

    const startAnimation = () => {
      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setCount(numericValue);
          clearInterval(timer);
        } else {
          setCount(Math.floor(increment * currentStep));
        }
      }, duration / steps);

      return timer;
    };

    const timeoutId = setTimeout(startAnimation, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [numericValue, delay, animateCurrency, animateNumber]);

  const displayValue = animateCurrency
    ? formatCurrency(count)
    : animateNumber
    ? count.toString()
    : value;

  return (
    <div
      className="group bg-surface rounded-xl p-lg border border-background shadow-sm hover:shadow-xl hover:border-orange/20 transition-all duration-300 animate-fadeIn cursor-pointer"
      style={{ animationDelay: delay }}
    >
      {/* Icon and Traffic Light */}
      <div className="flex items-center justify-between mb-md">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
          style={{
            background: `linear-gradient(135deg, ${iconColor}15, ${iconColor}05)`,
          }}
        >
          <Icon
            icon={icon}
            className="w-6 h-6 transition-colors duration-300"
            style={{ color: iconColor }}
          />
        </div>
        <TrafficLightDot status={status} />
      </div>

      {/* Label */}
      <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-sm flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </h3>

      {/* Value */}
      <p className="font-display text-h1 md:text-[36px] text-text-primary mb-xs tracking-tight tabular-nums">
        {displayValue}
      </p>

      {/* Status Text */}
      <p className="text-small text-text-secondary">{statusText}</p>
    </div>
  );
}

function ScoreRubricModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const tiers = [
    { range: "90 – 100", label: "Thriving", color: "#43A047", bg: "bg-[#43A047]/10", description: "Your business is in excellent financial shape. Strong profit margins, healthy cash reserves, and receivables are under control." },
    { range: "75 – 89", label: "Solid", color: "#66BB6A", bg: "bg-[#66BB6A]/10", description: "Things are looking good overall. There might be one area to keep an eye on, but nothing urgent. You're in a strong position to invest or grow." },
    { range: "60 – 74", label: "Needs Attention", color: "#F9A825", bg: "bg-[#F9A825]/10", description: "Your business is okay, but there are a couple of things that could become problems if they're not addressed. Time to look closer." },
    { range: "40 – 59", label: "At Risk", color: "#EF6C00", bg: "bg-[#EF6C00]/10", description: "Multiple areas need attention. Profit margins may be thin, cash reserves are low, or you're waiting too long to get paid." },
    { range: "Below 40", label: "Critical", color: "#D32F2F", bg: "bg-[#D32F2F]/10", description: "Your finances need immediate action. Cash could run out soon, expenses may be outpacing revenue. Focus on stabilizing before anything else." },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]"
        onClick={onClose}
        style={{ animation: "fadeIn 0.2s ease-out" }}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90vw] max-w-lg bg-white rounded-2xl shadow-2xl border border-border-light overflow-hidden"
        style={{ animation: "fadeIn 0.25s ease-out" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <h2 className="font-display text-xl text-text-primary">How Your Score Works</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-text-muted hover:text-text-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-1">
          <p className="text-sm text-text-secondary mb-4">
            Your health score is a composite of profit margin, cash runway, receivables, and cash flow — the same factors a financial advisor would look at.
          </p>
          {tiers.map((tier) => (
            <div key={tier.label} className={`flex items-start gap-3 p-3 rounded-xl ${tier.bg}`}>
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-text-primary">{tier.label}</span>
                  <span className="text-xs text-text-muted">{tier.range}</span>
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">{tier.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-border-light bg-background/50">
          <p className="text-xs text-text-muted text-center">
            Scores update automatically when your financial data changes.
          </p>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, loading: _authLoading } = useRequireAuth();
  const router = useRouter();
  const { subscription } = useAuth();
  const trialMode = isInTrial(subscription);
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [rubricOpen, setRubricOpen] = useState(false);
  const toggleRubric = useCallback(() => setRubricOpen((v) => !v), []);

  useEffect(() => {
    async function fetchLatestAssessment() {
      if (!user) return;

      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { data, error } = await client.database
          .from("health_assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          setAssessment(null);
        } else {
          setAssessment(data);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching assessment:", error);
        setAssessment(null);
        setLoading(false);
      }
    }

    fetchLatestAssessment();
  }, [user]);

  // ─── Financial Snapshots (for P&L Snapshot + Income Trend) ───────────────
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);

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
          .order("period_date", { ascending: false })
          .limit(7);

        if (!error && data) {
          setSnapshots(data as FinancialSnapshot[]);
        }
      } catch (err) {
        console.error("Error fetching snapshots:", err);
      }
    }
    fetchSnapshots();
  }, [user]);

  const latestSnapshot = snapshots[0] ?? null;
  const priorMonthSnapshot = snapshots[1] ?? null;

  const plRows = useMemo(() => {
    if (!latestSnapshot) return [];
    const c = latestSnapshot;
    const p = priorMonthSnapshot;

    function pctVar(curr: number | null | undefined, prior: number | null | undefined): number | null {
      const cv = curr ?? 0;
      const pv = prior ?? 0;
      if (pv === 0) return cv === 0 ? 0 : null;
      return ((cv - pv) / Math.abs(pv)) * 100;
    }

    return [
      { label: "Total Income", value: c.total_income ?? 0, change: pctVar(c.total_income, p?.total_income), isNetProfit: false, tooltip: "All revenue your business earned before any expenses are deducted." },
      { label: "Gross Profit", value: c.gross_profit ?? 0, change: pctVar(c.gross_profit, p?.gross_profit), isNetProfit: false, tooltip: "Revenue minus the direct costs of delivering your services. Shows how efficiently you deliver." },
      { label: "Total Expenses", value: c.total_expenses ?? 0, change: pctVar(c.total_expenses, p?.total_expenses), isNetProfit: false, tooltip: "All business costs including payroll, rent, software, marketing, and overhead." },
      { label: "Net Profit", value: c.net_profit ?? 0, change: pctVar(c.net_profit, p?.net_profit), isNetProfit: true, tooltip: "The bottom line — what's left after all expenses. This is the true measure of profitability." },
    ];
  }, [latestSnapshot, priorMonthSnapshot]);

  const chartSnapshots = useMemo(() => {
    return [...snapshots].slice(0, 6).reverse();
  }, [snapshots]);

  const incomeChartData = useMemo(() => {
    return chartSnapshots.map((s) => ({
      month: new Date(s.period_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      Income: s.total_income ?? 0,
      Expenses: s.total_expenses ?? 0,
    }));
  }, [chartSnapshots]);

  const timeOfDay = getTimeOfDay();
  const formattedDate = getFormattedDate();
  // Use actual user's name from profile, not business name
  const userName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || "there";

  // Calculate health score if assessment exists
  const healthScore = assessment
    ? calculateHealthScore({
        cashOnHand: assessment.cash_on_hand,
        monthlyRevenue: assessment.monthly_revenue,
        monthlyExpenses: assessment.monthly_expenses,
        accountsReceivable: assessment.accounts_receivable,
      })
    : null;

  // Pulse message — reflects health score tier
  const pulseText = (() => {
    if (loading || !assessment || !healthScore) return undefined;
    const score = healthScore.totalScore;

    const thriving = [
      "You're in excellent shape. Strong margins, healthy cash reserves — keep doing what you're doing.",
      "Your numbers look great. This is the kind of position where you can think about investing or growing.",
      "Everything's clicking. Profit margins are solid, cash is healthy, and receivables are under control.",
    ];
    const solid = [
      "Things are looking good overall. There might be one area to watch, but you're in a strong position.",
      "Solid financial health. You've got room to grow — just keep an eye on the details.",
      "Your business is in good shape. A few small tweaks could take you from good to great.",
    ];
    const needsAttention = [
      "Your business is okay, but a couple of things could become problems if they're not addressed soon.",
      "Not bad, but your cash runway or receivables might need a closer look. Worth digging in.",
      "There are some areas that need attention — nothing urgent yet, but don't let them slide.",
    ];
    const atRisk = [
      "Multiple areas need attention. Let's make a plan — margins or cash reserves could use some work.",
      "Your finances are showing some strain. Focus on the biggest gap first and work from there.",
      "Things are tight. Take a look at where cash is going and what you can tighten up.",
    ];
    const critical = [
      "Your finances need immediate attention. Cash could run out soon — focus on stabilizing first.",
      "This is a critical moment. Expenses may be outpacing revenue. Let's focus on the essentials.",
      "Urgent: your numbers are in a tough spot. Prioritize cash flow and cut what you can.",
    ];

    const pick = (arr: string[]) => arr[Math.floor(score) % arr.length];

    if (score >= 90) return pick(thriving);
    if (score >= 75) return pick(solid);
    if (score >= 60) return pick(needsAttention);
    if (score >= 40) return pick(atRisk);
    return pick(critical);
  })();

  return (
    <AppLayout pulseMessage={pulseText}>
      <div className="space-y-2xl">
        {/* Greeting Section - Editorial style with staggered reveal */}
        <div
          className="space-y-xs animate-fadeIn"
          style={{ animationDelay: "0ms" }}
        >
          <h1 className="font-display text-[42px] md:text-[56px] leading-tight text-text-primary tracking-tight">
            Good {timeOfDay},{" "}
            <span className="inline-block text-orange animate-fadeIn" style={{ animationDelay: "200ms" }}>
              {userName}
            </span>
          </h1>
          <p
            className="text-[15px] text-text-secondary font-body tracking-wide uppercase opacity-60 animate-fadeIn"
            style={{ animationDelay: "300ms" }}
          >
            {formattedDate}
          </p>
        </div>

        {/* Health Score Feature Card */}
        {loading ? (
          <div
            className="bg-surface rounded-lg p-2xl border-2 border-background shadow-sm animate-fadeIn"
            style={{ animationDelay: "400ms" }}
          >
            <div className="flex items-center justify-center h-96">
              <div className="animate-pulse space-y-lg text-center">
                <div className="w-56 h-56 bg-background rounded-full mx-auto" />
                <div className="w-32 h-8 bg-background rounded-md mx-auto" />
              </div>
            </div>
          </div>
        ) : !assessment || !healthScore ? (
          // Empty State - Warm invitation
          <div
            className="relative overflow-hidden bg-gradient-to-br from-surface via-surface to-background rounded-xl p-2xl border-2 border-orange shadow-lg animate-fadeIn"
            style={{ animationDelay: "400ms" }}
          >
            {/* Decorative orange glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange/5 rounded-full blur-3xl -z-0" />

            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-lg py-xl">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-32 h-32 bg-orange/10 rounded-full animate-fadeIn" style={{ animationDelay: "600ms" }}>
                <Icon
                  icon="ph:clipboard-text-duotone"
                  className="w-16 h-16 text-orange"
                />
              </div>

              {/* Heading */}
              <div className="space-y-sm animate-fadeIn" style={{ animationDelay: "700ms" }}>
                <h2 className="font-display text-[36px] md:text-[44px] leading-tight text-text-primary">
                  Let&apos;s get you some clarity
                </h2>
                <p className="text-[17px] leading-relaxed text-text-secondary max-w-xl mx-auto">
                  Answer a few simple questions about your business, and we&apos;ll
                  show you exactly where you stand financially—in plain English.
                </p>
              </div>

              {/* CTA */}
              <div className="pt-md animate-fadeIn" style={{ animationDelay: "800ms" }}>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => (router.push("/assessment"))}
                  className="text-[16px] px-2xl py-md shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Complete Your Assessment
                </Button>
              </div>

              {/* Subtle encouragement */}
              <p className="text-small text-text-muted animate-fadeIn" style={{ animationDelay: "900ms" }}>
                Takes about 2 minutes
              </p>
            </div>
          </div>
        ) : (
          // Health Score Display - Magazine feature style
          <div
            className="relative overflow-hidden bg-surface rounded-xl border-2 border-orange shadow-xl animate-fadeIn"
            style={{ animationDelay: "400ms" }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange via-orange/60 to-orange" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange/3 rounded-full blur-3xl -z-0" />

            <div className="relative z-10 p-2xl">
              {/* Section Label */}
              <div className="mb-lg animate-fadeIn flex items-center gap-2" style={{ animationDelay: "500ms" }}>
                <span className="text-small font-body tracking-[0.15em] uppercase text-orange font-semibold">
                  Your Business Health
                </span>
                <button
                  onClick={toggleRubric}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-text-muted hover:text-orange bg-orange/5 hover:bg-orange/10 transition-colors"
                  title="How is this scored?"
                >
                  <Icon icon="ph:info-bold" className="w-3.5 h-3.5" />
                  <span>How is this scored?</span>
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-2xl items-center">
                {/* Left: Gauge */}
                <div className="flex flex-col items-center space-y-lg animate-fadeIn" style={{ animationDelay: "600ms" }}>
                  <div className="relative">
                    {/* Subtle glow behind gauge */}
                    <div
                      className="absolute inset-0 rounded-full blur-xl opacity-20"
                      style={{
                        backgroundColor: healthScore.totalScore >= 80 ? "#43A047" : healthScore.totalScore >= 50 ? "#F9A825" : "#D32F2F"
                      }}
                    />
                    <HealthScoreGauge score={healthScore.totalScore} size="lg" />
                  </div>

                  <div className="text-center space-y-sm">
                    <StatusBadge
                      status={getHealthStatus(healthScore.totalScore)}
                      className="text-[14px] px-lg py-sm"
                    />
                    <p className="text-small text-text-muted">
                      Last updated {new Date(assessment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Right: Context */}
                <div className="space-y-md animate-fadeIn" style={{ animationDelay: "700ms" }}>
                  <h3 className="font-display text-[28px] leading-tight text-text-primary">
                    {healthScore.totalScore >= 80
                      ? "You're in great shape"
                      : healthScore.totalScore >= 50
                      ? "A few things need attention"
                      : "Let's get you back on track"}
                  </h3>

                  <div className="space-y-sm text-[15px] leading-relaxed text-text-secondary">
                    <p className="flex items-start gap-sm">
                      <span className="text-orange mt-1 flex-shrink-0">•</span>
                      <span>{healthScore.cashRunway.description}</span>
                    </p>
                    <p className="flex items-start gap-sm">
                      <span className="text-orange mt-1 flex-shrink-0">•</span>
                      <span>{healthScore.profitMargin.description}</span>
                    </p>
                    <p className="flex items-start gap-sm">
                      <span className="text-orange mt-1 flex-shrink-0">•</span>
                      <span>{healthScore.receivablesHealth.description}</span>
                    </p>
                  </div>

                  <div className="pt-md">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => (router.push("/assessment/results"))}
                      className="text-[14px]"
                    >
                      View Full Breakdown
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards - Profit, Cash Flow, Runway */}
        {!loading && assessment && healthScore && (
          <div
            className="grid gap-md md:grid-cols-3 animate-fadeIn"
            style={{ animationDelay: "500ms" }}
          >
            {/* Profit Card */}
            <MetricCard
              label="Profit"
              value={latestSnapshot?.net_profit != null ? latestSnapshot.net_profit : "—"}
              statusText={latestSnapshot?.net_profit != null ? (latestSnapshot.net_profit >= 0 ? "On Track" : "Needs Attention") : "No data yet"}
              status={latestSnapshot?.net_profit != null ? (latestSnapshot.net_profit >= 0 ? "healthy" : "critical") : "attention"}
              delay="600ms"
              icon="ph:chart-line-bold"
              iconColor="#E65100"
              animateCurrency={latestSnapshot?.net_profit != null}
              tooltip="Your net profit after all expenses are deducted from revenue. A positive number means your business is making money."
            />

            {/* Cash Flow Card */}
            <MetricCard
              label="Cash Flow"
              value={latestSnapshot?.net_cash_flow != null ? latestSnapshot.net_cash_flow : "—"}
              statusText={latestSnapshot?.net_cash_flow != null ? (latestSnapshot.net_cash_flow >= 0 ? "Healthy" : "Needs Attention") : "No data yet"}
              status={latestSnapshot?.net_cash_flow != null ? (latestSnapshot.net_cash_flow >= 0 ? "healthy" : "critical") : "attention"}
              delay="700ms"
              icon="ph:wallet-bold"
              iconColor="#43A047"
              animateCurrency={latestSnapshot?.net_cash_flow != null}
              tooltip="The net amount of cash moving in and out of your business. Positive cash flow means more money is coming in than going out."
            />

            {/* Runway Card */}
            <LockedFeature locked={trialMode} className="rounded-xl">
              <MetricCard
                label="Runway"
                value={formatRunway(assessment.cash_on_hand, assessment.monthly_expenses)}
                statusText={getRunwayStatus(assessment.cash_on_hand, assessment.monthly_expenses)}
                status={getRunwayHealthStatus(assessment.cash_on_hand, assessment.monthly_expenses)}
                delay="800ms"
                icon="ph:timer-bold"
                iconColor="#7B1FA2"
                tooltip="How many months your business can operate at current spending levels with the cash you have on hand."
              />
            </LockedFeature>
          </div>
        )}

        {/* Cash Position Section */}
        {!loading && assessment && (
          <div
            className="bg-surface rounded-xl p-2xl border border-background shadow-sm animate-fadeIn"
            style={{ animationDelay: "900ms" }}
          >
            <h2 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-lg">
              Cash Position
            </h2>

            <div className="space-y-2xl">
              {/* Current Cash */}
              <div className="text-center md:text-left">
                <AnimatedCurrency
                  value={assessment.cash_on_hand}
                  className="font-display text-[56px] md:text-[72px] leading-none text-text-primary tracking-tight mb-xs block tabular-nums"
                  delay={900}
                />
                <p className="text-body text-text-secondary inline-flex items-center gap-1.5">
                  Cash on hand right now
                  <InfoTooltip text="The total liquid cash available in your business accounts right now. This is your financial safety net." />
                </p>
              </div>

              {/* Money In/Out Grid */}
              <div className="grid md:grid-cols-2 gap-xl pt-md border-t border-background">
                {/* Money In */}
                <div className="flex items-start gap-md">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-success"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                  <div>
                    <AnimatedCurrency
                      value={assessment.monthly_revenue}
                      className="font-display text-h1 text-success mb-xs block tabular-nums"
                      delay={1000}
                    />
                    <p className="text-small text-text-secondary inline-flex items-center gap-1.5">
                      Money In (last month)
                      <InfoTooltip text="Total revenue collected last month, including sales, services, and any other income sources." />
                    </p>
                  </div>
                </div>

                {/* Money Out */}
                <div className="flex items-start gap-md">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-error"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  </div>
                  <div>
                    <AnimatedCurrency
                      value={assessment.monthly_expenses}
                      className="font-display text-h1 text-error mb-xs block tabular-nums"
                      delay={1100}
                    />
                    <p className="text-small text-text-secondary inline-flex items-center gap-1.5">
                      Money Out (last month)
                      <InfoTooltip text="Total expenses paid last month, including payroll, rent, software, and all other business costs." />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Insight Card + Quick Action */}
        {!loading && assessment && (
          <div
            className="grid md:grid-cols-[1fr,auto] gap-md items-start animate-fadeIn"
            style={{ animationDelay: "1000ms" }}
          >
            {/* AI Insight */}
            <div className="bg-gradient-to-br from-orange/5 via-surface to-surface rounded-xl p-xl border border-orange/20 shadow-sm">
              <div className="flex items-start gap-md">
                {/* Lightbulb Icon */}
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-orange/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-orange"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>

                {/* Insight Text */}
                <div className="flex-1 pt-xs">
                  <h3 className="font-body text-body font-semibold text-orange mb-sm tracking-wide">
                    AI Insight
                  </h3>
                  <p className="text-[15px] leading-relaxed text-text-primary">
                    Your profit margin improved 8% this month. Slow week keeping expenses steady while revenue grew.
                    Consider setting aside extra cash to build your runway.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex md:items-center h-full">
              <Button
                variant="primary"
                size="lg"
                onClick={() => (router.push("/scenarios"))}
                className="w-full md:w-auto whitespace-nowrap text-[15px] px-xl py-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Run a Scenario
              </Button>
            </div>
          </div>
        )}

        {/* P&L Snapshot */}
        {!loading && (
          latestSnapshot ? (
            <div
              className="bg-surface rounded-xl p-2xl border border-background shadow-sm animate-fadeIn"
              style={{ animationDelay: "1100ms" }}
            >
              <h2 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-lg">
                P&L Snapshot{" "}
                <span className="ml-1 normal-case tracking-normal text-text-secondary">
                  — {new Date(latestSnapshot.period_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-background">
                      <th className="text-left py-2 pr-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                        Metric
                      </th>
                      <th className="text-right py-2 px-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                        Current Period
                      </th>
                      <th className="text-right py-2 pl-lg text-small font-semibold uppercase tracking-wider text-text-muted">
                        vs Prior Month
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plRows.map((row) => {
                      const isNeg = row.isNetProfit && row.value < 0;
                      const isPos = row.isNetProfit && row.value > 0;
                      const changePos = row.change !== null && row.change > 0;
                      const changeNeg = row.change !== null && row.change < 0;

                      return (
                        <tr key={row.label} className="border-b border-background last:border-b-0">
                          <td className={`py-3 pr-lg text-body ${row.isNetProfit || row.label === "Total Income" ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                            <span className="inline-flex items-center gap-1.5">
                              {row.label}
                              {row.tooltip && <InfoTooltip text={row.tooltip} />}
                            </span>
                          </td>
                          <td className={`text-right py-3 px-lg text-body tabular-nums font-semibold ${isNeg ? "text-error" : isPos ? "text-success" : "text-text-primary"}`}>
                            {formatCurrency(row.value)}
                          </td>
                          <td className="text-right py-3 pl-lg text-small tabular-nums">
                            {row.change !== null ? (
                              <span className={`font-medium ${changePos ? "text-success" : changeNeg ? "text-error" : "text-text-muted"}`}>
                                {changePos ? "▲" : changeNeg ? "▼" : ""} {Math.abs(row.change).toFixed(1)}%
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
          ) : null
        )}

        {/* Income Trend */}
        {!loading && (
          incomeChartData.length >= 2 ? (
            <div
              className="bg-surface rounded-xl p-2xl border border-background shadow-sm animate-fadeIn"
              style={{ animationDelay: "1200ms" }}
            >
              <h2 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-lg">
                Income Trend
              </h2>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={incomeChartData} barGap={4} barCategoryGap="20%">
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
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
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
                  <Bar dataKey="Income" fill="#E8541A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              className="bg-surface rounded-xl px-2xl py-lg border border-background shadow-sm animate-fadeIn"
              style={{ animationDelay: "1200ms" }}
            >
              <h2 className="font-body text-small tracking-[0.1em] uppercase text-text-muted mb-sm">
                Income Trend
              </h2>
              <p className="text-body text-text-secondary">
                More data will appear as you sync each month
              </p>
            </div>
          )
        )}
      </div>

      <ScoreRubricModal open={rubricOpen} onClose={() => setRubricOpen(false)} />

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
