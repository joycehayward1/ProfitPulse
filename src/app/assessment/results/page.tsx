"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateHealthScore, getHealthStatus, type HealthScoreBreakdown } from "@/lib/healthScore";
import { useToast } from "@/components/ui/Toast";
import { generateAssessmentSummary } from "@/lib/ai-insights";
import type { Recommendation } from "@/lib/database.types";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AssessmentResultsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, loading: authLoading } = useRequireAuth();
  const [breakdown, setBreakdown] = useState<HealthScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [payrollPercent, setPayrollPercent] = useState<number | null>(null);
  const [payrollRevenuePercent, setPayrollRevenuePercent] = useState<number | null>(null);

  useEffect(() => {
    async function loadResults() {
      if (!user) return;

      try {
        let assessmentData = null;

        // First, try to load from sessionStorage (for testing/demo mode)
        const sessionData = sessionStorage.getItem('assessment_data');
        if (sessionData) {
          console.log('Loading assessment from sessionStorage');
          assessmentData = JSON.parse(sessionData);
        } else {
          // Try to load from database
          try {
            const { getInsForgeClient } = await import("@/lib/insforge");
            const client = getInsForgeClient();

            const { data, error } = await client.database
              .from('health_assessments')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (!error && data) {
              assessmentData = data;
            }
          } catch (dbError) {
            console.warn('Database load failed, no session data available:', dbError);
          }
        }

        // If no data from either source, redirect to assessment
        if (!assessmentData) {
          showToast('error', 'No assessment found. Please complete the assessment first.');
          router.push('/assessment');
          return;
        }

        // Calculate the health score
        const scoreBreakdown = calculateHealthScore({
          cashOnHand: assessmentData.cash_on_hand,
          monthlyRevenue: assessmentData.monthly_revenue,
          monthlyExpenses: assessmentData.monthly_expenses,
          accountsReceivable: assessmentData.accounts_receivable,
        });

        setBreakdown(scoreBreakdown);

        // Calculate payroll percentage if expense breakdown available
        if (assessmentData.expense_breakdown?.payroll && assessmentData.monthly_expenses > 0) {
          const payrollPct = (assessmentData.expense_breakdown.payroll / assessmentData.monthly_expenses) * 100;
          setPayrollPercent(payrollPct);
        }
        if (assessmentData.expense_breakdown?.payroll && assessmentData.monthly_revenue > 0) {
          const payrollRevPct = (assessmentData.expense_breakdown.payroll / assessmentData.monthly_revenue) * 100;
          setPayrollRevenuePercent(payrollRevPct);
        }

        // Try to update database if we have an ID (means it came from DB)
        if (assessmentData.id) {
          try {
            const { getInsForgeClient } = await import("@/lib/insforge");
            const client = getInsForgeClient();

            await client.database
              .from('health_assessments')
              .update({ health_score: scoreBreakdown.totalScore })
              .eq('id', assessmentData.id);
          } catch (updateError) {
            console.warn('Could not update health score in database:', updateError);
          }
        }

        // Generate AI summary and recommendations
        setAiLoading(true);
        const aiResult = await generateAssessmentSummary({
          cash_on_hand: assessmentData.cash_on_hand,
          monthly_revenue: assessmentData.monthly_revenue,
          monthly_expenses: assessmentData.monthly_expenses,
          accounts_receivable: assessmentData.accounts_receivable,
          employee_count: assessmentData.employee_count || 0,
          biggest_worry: assessmentData.biggest_worry || '',
          health_score: scoreBreakdown.totalScore,
        });

        if (aiResult) {
          setAiSummary(aiResult.summary);
          setRecommendations(aiResult.recommendations);

          // Try to save AI insights to database if we have an ID
          if (assessmentData.id) {
            try {
              const { getInsForgeClient } = await import("@/lib/insforge");
              const client = getInsForgeClient();

              await client.database
                .from('health_assessments')
                .update({
                  ai_summary: aiResult.summary,
                  recommendations: aiResult.recommendations,
                })
                .eq('id', assessmentData.id);
            } catch (aiUpdateError) {
              console.warn('Could not save AI insights to database:', aiUpdateError);
            }
          }
        }
        setAiLoading(false);
      } catch (error) {
        console.error('Error loading assessment results:', error);
        showToast('error', 'Failed to load results. Please try again.');
        router.push('/assessment');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [user, router, showToast]);

  if (loading || !breakdown) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-lg text-text-secondary font-body">
            Loading your breakdown...
          </p>
        </div>
      </div>
    );
  }

  const status = getHealthStatus(breakdown.totalScore);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-display text-text-primary mb-3">
            Your Business Health Score
          </h1>
          <p className="text-lg text-text-secondary font-body">
            Here&apos;s what your numbers are telling us.
          </p>
        </div>

        {/* Health Score Gauge */}
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 mb-8">
          <div className="flex flex-col items-center mb-8">
            <HealthScoreGauge score={breakdown.totalScore} size="lg" className="mb-6" />
            <StatusBadge status={status} className="text-base" />
          </div>

          {/* Status Message */}
          <div className="text-center max-w-2xl mx-auto">
            {status === "healthy" && (
              <p className="text-lg text-text-primary font-body">
                Great news! Your business is in solid financial shape. Keep up the good work,
                and continue monitoring your key metrics to stay on track.
              </p>
            )}
            {status === "attention" && (
              <p className="text-lg text-text-primary font-body">
                Your business is doing okay, but there are a few areas that need attention.
                Review the breakdown below to see where you can improve.
              </p>
            )}
            {status === "critical" && (
              <p className="text-lg text-text-primary font-body">
                Your business needs immediate attention. Don&apos;t worry—we&apos;re here to help you
                understand what&apos;s happening and create a plan to get back on track.
              </p>
            )}
          </div>
        </div>

        {/* Formula Breakdown */}
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 mb-8">
          <h2 className="text-2xl font-display text-text-primary mb-6">
            Here&apos;s how we calculated your score:
          </h2>

          <div className="space-y-6">
            {/* Cash Runway */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-body font-semibold text-text-primary">
                  Cash Runway
                </h3>
                <span className="text-text-muted font-body text-sm">
                  {breakdown.cashRunway.weight}% of total score
                </span>
              </div>
              <p className="text-text-secondary font-body mb-3">
                {breakdown.cashRunway.description}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange h-full rounded-full transition-all duration-700"
                    style={{ width: `${breakdown.cashRunway.score}%` }}
                  />
                </div>
                <span className="text-text-primary font-display text-xl font-semibold min-w-[50px] text-right">
                  {breakdown.cashRunway.score}
                </span>
              </div>
            </div>

            {/* Profit Margin */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-body font-semibold text-text-primary">
                  Profit Margin
                </h3>
                <span className="text-text-muted font-body text-sm">
                  {breakdown.profitMargin.weight}% of total score
                </span>
              </div>
              <p className="text-text-secondary font-body mb-3">
                {breakdown.profitMargin.description}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange h-full rounded-full transition-all duration-700"
                    style={{ width: `${breakdown.profitMargin.score}%` }}
                  />
                </div>
                <span className="text-text-primary font-display text-xl font-semibold min-w-[50px] text-right">
                  {breakdown.profitMargin.score}
                </span>
              </div>
            </div>

            {/* Receivables Health */}
            <div className={payrollPercent !== null ? "border-b border-gray-200 pb-6" : "pb-2"}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-body font-semibold text-text-primary">
                  Receivables Health
                </h3>
                <span className="text-text-muted font-body text-sm">
                  {breakdown.receivablesHealth.weight}% of total score
                </span>
              </div>
              <p className="text-text-secondary font-body mb-3">
                {breakdown.receivablesHealth.description}
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange h-full rounded-full transition-all duration-700"
                    style={{ width: `${breakdown.receivablesHealth.score}%` }}
                  />
                </div>
                <span className="text-text-primary font-display text-xl font-semibold min-w-[50px] text-right">
                  {breakdown.receivablesHealth.score}
                </span>
              </div>
            </div>

            {/* Payroll as % of Expenses/Revenue */}
            {payrollPercent !== null && (
              <div className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-body font-semibold text-text-primary">
                    Payroll Ratio
                  </h3>
                  <span className="text-text-muted font-body text-sm">
                    Insight
                  </span>
                </div>
                <p className="text-text-secondary font-body mb-3">
                  Payroll makes up <span className="font-semibold text-text-primary">{payrollPercent.toFixed(1)}%</span> of your total expenses
                  {payrollRevenuePercent !== null && (
                    <> and <span className="font-semibold text-text-primary">{payrollRevenuePercent.toFixed(1)}%</span> of your revenue</>
                  )}.
                  {payrollPercent > 50
                    ? " This is on the higher side — typical for service businesses, but worth monitoring."
                    : payrollPercent > 30
                    ? " This is in a healthy range for most businesses."
                    : " This is relatively lean — make sure you have enough capacity to grow."}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-purple h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(payrollPercent, 100)}%` }}
                    />
                  </div>
                  <span className="text-text-primary font-display text-xl font-semibold min-w-[50px] text-right">
                    {payrollPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary & Recommendations */}
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 mb-8">
          <h2 className="text-2xl font-display text-text-primary mb-6">
            What this means for your business
          </h2>

          {/* AI Summary */}
          {aiLoading ? (
            <div className="mb-8 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          ) : aiSummary ? (
            <p className="text-lg text-text-primary font-body mb-8 leading-relaxed">
              {aiSummary}
            </p>
          ) : (
            <p className="text-lg text-text-secondary font-body mb-8 italic">
              AI insights temporarily unavailable. Your score is calculated and saved.
            </p>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <>
              <h3 className="text-xl font-display text-text-primary mb-4">
                Top recommendations for you:
              </h3>
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="bg-background border-l-4 border-orange p-6 rounded-md"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex-shrink-0 w-8 h-8 bg-orange text-white rounded-full flex items-center justify-center font-display font-semibold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="text-lg font-body font-semibold text-text-primary mb-2">
                          {rec.title}
                        </h4>
                        <p className="text-text-secondary font-body">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {aiLoading && recommendations.length === 0 && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-background p-6 rounded-md">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/dashboard')}
            className="min-w-[200px]"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
