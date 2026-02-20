"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateHealthScore, getHealthStatus, type HealthScoreBreakdown } from "@/lib/healthScore";
import { useToast } from "@/components/ui/Toast";

export default function AssessmentResultsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [breakdown, setBreakdown] = useState<HealthScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResults() {
      try {
        // Dynamic import to avoid SSR issues
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();

        // TODO: Replace with actual auth check once InsForge credentials are available
        const userId = "placeholder-user-id";

        // Fetch the most recent assessment
        const { data, error } = await client.database
          .from('health_assessments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          showToast('error', 'No assessment found. Please complete the assessment first.');
          router.push('/assessment');
          return;
        }

        // Calculate the health score
        const scoreBreakdown = calculateHealthScore({
          cashOnHand: data.cash_on_hand,
          monthlyRevenue: data.monthly_revenue,
          monthlyExpenses: data.monthly_expenses,
          accountsReceivable: data.accounts_receivable,
        });

        setBreakdown(scoreBreakdown);

        // Update the assessment record with the calculated score
        const { error: updateError } = await client.database
          .from('health_assessments')
          .update({ health_score: scoreBreakdown.totalScore })
          .eq('id', data.id);

        if (updateError) {
          console.error('Error updating health score:', updateError);
        }
      } catch (error) {
        console.error('Error loading assessment results:', error);
        showToast('error', 'Failed to load results. Please try again.');
        router.push('/assessment');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [router, showToast]);

  if (loading || !breakdown) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-4 text-lg text-text-secondary font-body">
            Calculating your health score...
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
            <div className="pb-2">
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
          </div>
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
