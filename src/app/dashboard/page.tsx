"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { calculateHealthScore, getHealthStatus } from "@/lib/healthScore";
import type { HealthAssessment } from "@/lib/database.types";

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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [userName] = useState("Jessica"); // TODO: Replace with real user name from auth

  useEffect(() => {
    async function fetchLatestAssessment() {
      try {
        // TODO: Replace with real InsForge query when credentials are available
        // const { getInsForgeClient } = await import("@/lib/insforge");
        // const client = getInsForgeClient();
        // const { data, error } = await client.database
        //   .from("health_assessments")
        //   .select("*")
        //   .eq("user_id", currentUserId)
        //   .order("created_at", { ascending: false })
        //   .limit(1)
        //   .single();

        // Placeholder: simulate no assessment for empty state
        setAssessment(null);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching assessment:", error);
        setAssessment(null);
        setLoading(false);
      }
    }

    fetchLatestAssessment();
  }, []);

  const timeOfDay = getTimeOfDay();
  const formattedDate = getFormattedDate();

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

        {/* Placeholder for future metric cards */}
        {!loading && assessment && (
          <div className="opacity-40 pointer-events-none">
            <p className="text-small text-text-muted mb-md">Coming soon: Detailed metrics</p>
            <div className="grid gap-md md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-surface rounded-lg p-lg border border-background shadow-sm"
                >
                  <div className="h-32 bg-background/50 rounded-md" />
                </div>
              ))}
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
