"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { TrafficLightDot } from "@/components/ui/TrafficLightDot";
import type { HealthStatus } from "@/components/ui/TrafficLightDot";
import { calculateHealthScore, getHealthStatus } from "@/lib/healthScore";
import type { HealthAssessment } from "@/lib/database.types";
import { useRequireAuth } from "@/hooks/useRequireAuth";

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

interface MetricCardProps {
  label: string;
  value: string;
  statusText: string;
  status: HealthStatus;
  delay: string;
}

function MetricCard({ label, value, statusText, status, delay }: MetricCardProps) {
  return (
    <div
      className="bg-surface rounded-xl p-lg border border-background shadow-sm hover:shadow-md transition-shadow duration-300 animate-fadeIn"
      style={{ animationDelay: delay }}
    >
      {/* Label with Traffic Light */}
      <div className="flex items-center justify-between mb-md">
        <h3 className="font-body text-small tracking-[0.1em] uppercase text-text-muted">
          {label}
        </h3>
        <TrafficLightDot status={status} />
      </div>

      {/* Value */}
      <p className="font-display text-h1 md:text-[36px] text-text-primary mb-xs tracking-tight">
        {value}
      </p>

      {/* Status Text */}
      <p className="text-small text-text-secondary">{statusText}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);

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

  return (
    <AppLayout>
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
              <div className="inline-flex items-center justify-center w-24 h-24 bg-orange/10 rounded-full animate-fadeIn" style={{ animationDelay: "600ms" }}>
                <svg
                  className="w-12 h-12 text-orange"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
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
                  onClick={() => (window.location.href = "/assessment")}
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
              <div className="mb-lg animate-fadeIn" style={{ animationDelay: "500ms" }}>
                <span className="text-small font-body tracking-[0.15em] uppercase text-orange font-semibold">
                  Your Business Health
                </span>
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
                      {/* Placeholder for delta - will calculate from historical data */}
                      <span className="text-success font-semibold">+5</span> from last
                      week
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
                      onClick={() => (window.location.href = "/assessment/results")}
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
              value={formatCurrency(assessment.monthly_revenue - assessment.monthly_expenses)}
              statusText="On Track"
              status="healthy"
              delay="600ms"
            />

            {/* Cash Flow Card */}
            <MetricCard
              label="Cash Flow"
              value={formatCurrency(assessment.monthly_revenue - assessment.monthly_expenses)}
              statusText="Healthy"
              status="healthy"
              delay="700ms"
            />

            {/* Runway Card */}
            <MetricCard
              label="Runway"
              value={formatRunway(assessment.cash_on_hand, assessment.monthly_expenses)}
              statusText={getRunwayStatus(assessment.cash_on_hand, assessment.monthly_expenses)}
              status={getRunwayHealthStatus(assessment.cash_on_hand, assessment.monthly_expenses)}
              delay="800ms"
            />
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
                <p className="font-display text-[56px] md:text-[72px] leading-none text-text-primary tracking-tight mb-xs">
                  {formatCurrency(assessment.cash_on_hand)}
                </p>
                <p className="text-body text-text-secondary">Cash on hand right now</p>
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
                    <p className="font-display text-h1 text-success mb-xs">
                      {formatCurrency(assessment.monthly_revenue)}
                    </p>
                    <p className="text-small text-text-secondary">Money In (last month)</p>
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
                    <p className="font-display text-h1 text-error mb-xs">
                      {formatCurrency(assessment.monthly_expenses)}
                    </p>
                    <p className="text-small text-text-secondary">Money Out (last month)</p>
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
                onClick={() => (window.location.href = "/scenarios")}
                className="w-full md:w-auto whitespace-nowrap text-[15px] px-xl py-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Run a Scenario
              </Button>
            </div>
          </div>
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
