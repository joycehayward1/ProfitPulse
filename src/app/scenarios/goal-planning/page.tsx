"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { generateScenarioExplanation } from "@/lib/ai-insights";
import { ArrowLeft, Flag, TrendingUp } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface GoalResult {
  annualGoal: number;
  currentMonthlyRevenue: number;
  currentMonthlyExpenses: number;
  ytdRevenue: number;
  ytdExpenses: number;
  monthsRemaining: number;
  requiredMonthly: number;
  currentMonthlyProfit: number;
  ytdProfit: number;
  progressPercent: number;
  status: "healthy" | "attention" | "critical";
  explanation: string | null;
}

export default function GoalPlanningPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useRequireAuth();

  // Form inputs
  const [annualGoal, setAnnualGoal] = useState("");
  const [currentMonthly, setCurrentMonthly] = useState("");
  const [currentMonthlyExpenses, setCurrentMonthlyExpenses] = useState("");
  const [ytdRevenue, setYtdRevenue] = useState("");
  const [ytdExpenses, setYtdExpenses] = useState("");
  const [monthsRemaining, setMonthsRemaining] = useState(0);

  // Results
  const [result, setResult] = useState<GoalResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFinancialData() {
      if (!user) return;

      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();

        const { data, error } = await client.database
          .from('financial_snapshots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          if (data.total_income) setCurrentMonthly(data.total_income.toString());
          if (data.total_expenses) setCurrentMonthlyExpenses(data.total_expenses.toString());
          return;
        }

        const { data: assessment } = await client.database
          .from('health_assessments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (assessment) {
          if (assessment.monthly_revenue) setCurrentMonthly(assessment.monthly_revenue.toString());
          if (assessment.monthly_expenses) setCurrentMonthlyExpenses(assessment.monthly_expenses.toString());
          if (assessment.ytd_revenue) setYtdRevenue(assessment.ytd_revenue.toString());
          if (assessment.ytd_expenses) setYtdExpenses(assessment.ytd_expenses.toString());
        } else if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    }

    // Calculate months remaining in fiscal year (defaults to calendar year-end)
    const now = new Date();
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    const monthsLeft = Math.max(1, Math.ceil((yearEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    setMonthsRemaining(monthsLeft);

    loadFinancialData();
  }, [user]);

  const handleCalculate = async () => {
    const goal = parseFloat(annualGoal);
    const monthly = parseFloat(currentMonthly);
    const monthlyExpenses = parseFloat(currentMonthlyExpenses) || 0;
    const ytdRev = parseFloat(ytdRevenue) || 0;
    const ytdExp = parseFloat(ytdExpenses) || 0;
    const months = monthsRemaining;

    if (!goal || goal <= 0) {
      showToast('error', 'Please enter a valid annual goal');
      return;
    }

    if (!monthly || monthly <= 0) {
      showToast('error', 'Please enter your current monthly revenue');
      return;
    }

    if (!months || months <= 0) {
      showToast('error', 'Please enter months remaining');
      return;
    }

    // Use actual YTD revenue if provided, otherwise estimate from monthly
    const currentMonth = new Date().getMonth() + 1;
    const monthsElapsed = currentMonth;
    const revenueSoFar = ytdRev > 0 ? ytdRev : monthly * monthsElapsed;
    const remaining = goal - revenueSoFar;
    const requiredMonthly = Math.max(0, remaining / months);

    const progressPercent = Math.min((revenueSoFar / goal) * 100, 100);
    const currentMonthlyProfit = monthly - monthlyExpenses;
    const ytdProfit = ytdRev > 0 && ytdExp > 0 ? ytdRev - ytdExp : currentMonthlyProfit * monthsElapsed;

    // Determine status based on required growth
    const growthRequired = ((requiredMonthly - monthly) / monthly) * 100;
    let status: "healthy" | "attention" | "critical";

    if (progressPercent >= 80 || growthRequired <= 10) {
      status = "healthy";
    } else if (growthRequired <= 30) {
      status = "attention";
    } else {
      status = "critical";
    }

    setResult({
      annualGoal: goal,
      currentMonthlyRevenue: monthly,
      currentMonthlyExpenses: monthlyExpenses,
      ytdRevenue: revenueSoFar,
      ytdExpenses: ytdExp > 0 ? ytdExp : monthlyExpenses * monthsElapsed,
      monthsRemaining: months,
      requiredMonthly,
      currentMonthlyProfit,
      ytdProfit,
      progressPercent,
      status,
      explanation: null,
    });

    // Generate AI explanation
    setAiLoading(true);
    const aiExplanation = await generateScenarioExplanation(
      "goal-planning",
      {
        annualGoal: goal,
        currentMonthlyRevenue: monthly,
        currentMonthlyExpenses: monthlyExpenses,
        ytdRevenue: revenueSoFar,
        ytdExpenses: ytdExp > 0 ? ytdExp : monthlyExpenses * monthsElapsed,
        monthsRemaining: months,
      },
      {
        requiredMonthly,
        progressPercent,
        growthRequired,
        currentMonthlyProfit,
        ytdProfit,
      }
    );

    setResult(prev => prev ? { ...prev, explanation: aiExplanation } : null);
    setAiLoading(false);
  };

  const handleReset = () => {
    setAnnualGoal("");
    setCurrentMonthlyExpenses("");
    setYtdRevenue("");
    setYtdExpenses("");
    setResult(null);
  };

  const handleSave = async () => {
    if (!result || !user) return;

    setSaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { error } = await client.database
        .from('scenarios')
        .insert([{
          user_id: user.id,
          scenario_type: 'goal-planning',
          inputs: {
            annualGoal: result.annualGoal,
            currentMonthlyRevenue: result.currentMonthlyRevenue,
            currentMonthlyExpenses: result.currentMonthlyExpenses,
            ytdRevenue: result.ytdRevenue,
            ytdExpenses: result.ytdExpenses,
            monthsRemaining: result.monthsRemaining,
          },
          result: {
            requiredMonthly: result.requiredMonthly,
            progressPercent: result.progressPercent,
            currentMonthlyProfit: result.currentMonthlyProfit,
            ytdProfit: result.ytdProfit,
            status: result.status,
            summary: `To hit $${result.annualGoal.toLocaleString()} by year-end, you need $${Math.round(result.requiredMonthly).toLocaleString()}/month`,
          },
          ai_explanation: result.explanation,
        }]);

      if (error) throw error;

      showToast('success', 'Scenario saved successfully');
      router.push('/scenarios');
    } catch (error) {
      console.error('Error saving scenario:', error);
      showToast('error', 'Failed to save scenario');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background pb-16">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FFF8F5] to-[#FFE8DC] border-b border-orange/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <button
              onClick={() => router.push('/scenarios')}
              className="group flex items-center gap-2 text-text-secondary hover:text-orange transition-colors mb-6"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="font-body text-sm">Back to Scenarios</span>
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center">
                <Flag className="w-6 h-6 text-orange" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-2">
                  Goal Planning
                </h1>
                <p className="text-text-secondary font-body">
                  Plan your revenue targets and monthly goals to hit your annual number.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-display text-text-primary mb-6">
                Your Goal
              </h2>

              <div className="space-y-6">
                {/* Annual Revenue Goal */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Annual revenue goal
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={annualGoal}
                      onChange={(e) => setAnnualGoal(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="500,000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Where you want to be by fiscal year-end
                  </p>
                </div>

                {/* Current Monthly Revenue */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Current monthly revenue
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={currentMonthly}
                      onChange={(e) => setCurrentMonthly(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="35,000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    What you&apos;re bringing in each month now
                  </p>
                </div>

                {/* Current Monthly Expenses */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Current monthly expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={currentMonthlyExpenses}
                      onChange={(e) => setCurrentMonthlyExpenses(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="20,000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Your total monthly operating costs
                  </p>
                </div>

                {/* YTD Revenue */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Year-to-date revenue
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={ytdRevenue}
                      onChange={(e) => setYtdRevenue(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="70,000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Total revenue earned so far this fiscal year
                  </p>
                </div>

                {/* YTD Expenses */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Year-to-date expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={ytdExpenses}
                      onChange={(e) => setYtdExpenses(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="40,000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Total expenses incurred so far this fiscal year
                  </p>
                </div>

                {/* Months Remaining in Fiscal Year */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Months remaining in fiscal year
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={monthsRemaining}
                    onChange={(e) => setMonthsRemaining(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                    placeholder="6"
                  />
                  <p className="text-xs text-text-muted font-body mt-1">
                    Auto-calculated to calendar year-end (adjust for your fiscal year)
                  </p>
                </div>

                {/* Calculate Button */}
                <Button
                  variant="primary"
                  onClick={handleCalculate}
                  className="w-full"
                >
                  Calculate Monthly Target
                </Button>
              </div>
            </div>

            {/* Results */}
            <div>
              {result ? (
                <div className="space-y-6">
                  {/* Result Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-start justify-between mb-6">
                      <h2 className="text-xl font-display text-text-primary">
                        Your Path Forward
                      </h2>
                      <StatusBadge status={result.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-gradient-to-br from-orange/5 to-orange/10 rounded-xl p-6 mb-6">
                      <p className="text-sm font-body text-text-secondary mb-3">
                        To hit <span className="font-semibold text-text-primary">{formatCurrency(result.annualGoal)}</span> by year-end:
                      </p>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-display text-orange">
                          {formatCurrency(result.requiredMonthly)}
                        </span>
                        <span className="text-lg font-body text-text-secondary">
                          /month
                        </span>
                      </div>
                      <p className="text-sm font-body text-text-secondary">
                        for the next <span className="font-semibold">{result.monthsRemaining} months</span>
                      </p>
                    </div>

                    {/* Progress Visualization */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-body font-medium text-text-primary">
                          Year-to-date progress
                        </h3>
                        <span className="text-sm font-display text-text-primary">
                          {Math.round(result.progressPercent)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden mb-4">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange to-orange/80 transition-all duration-700 flex items-center justify-end pr-3"
                          style={{ width: `${Math.min(result.progressPercent, 100)}%` }}
                        >
                          {result.progressPercent > 10 && (
                            <span className="text-xs font-body text-white font-medium">
                              {Math.round(result.progressPercent)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Financial Snapshot */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">Monthly revenue</p>
                          <p className="text-lg font-display text-text-primary">
                            {formatCurrency(result.currentMonthlyRevenue)}
                            <span className="text-xs font-body text-text-secondary">/mo</span>
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">Monthly expenses</p>
                          <p className="text-lg font-display text-text-primary">
                            {formatCurrency(result.currentMonthlyExpenses)}
                            <span className="text-xs font-body text-text-secondary">/mo</span>
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">YTD revenue</p>
                          <p className="text-lg font-display text-text-primary">
                            {formatCurrency(result.ytdRevenue)}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">YTD expenses</p>
                          <p className="text-lg font-display text-text-primary">
                            {formatCurrency(result.ytdExpenses)}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">Monthly profit</p>
                          <p className={`text-lg font-display ${result.currentMonthlyProfit >= 0 ? 'text-success' : 'text-critical'}`}>
                            {formatCurrency(result.currentMonthlyProfit)}
                            <span className="text-xs font-body text-text-secondary">/mo</span>
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-xs font-body text-text-muted mb-1">Need to hit</p>
                          <p className="text-lg font-display text-orange">
                            {formatCurrency(result.requiredMonthly)}
                            <span className="text-xs font-body text-text-secondary">/mo</span>
                          </p>
                        </div>
                      </div>

                      {/* Growth indicator */}
                      {result.requiredMonthly > result.currentMonthlyRevenue && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-orange/10 to-transparent rounded-lg border-l-4 border-orange">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-orange" />
                            <p className="text-sm font-body font-medium text-text-primary">
                              Growth needed
                            </p>
                          </div>
                          <p className="text-sm font-body text-text-secondary">
                            You need to grow by{' '}
                            <span className="font-semibold text-orange">
                              {formatCurrency(result.requiredMonthly - result.currentMonthlyRevenue)}/month
                            </span>
                            {' '}({Math.round(((result.requiredMonthly - result.currentMonthlyRevenue) / result.currentMonthlyRevenue) * 100)}% increase)
                          </p>
                        </div>
                      )}

                      {result.requiredMonthly <= result.currentMonthlyRevenue && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-success/10 to-transparent rounded-lg border-l-4 border-success">
                          <p className="text-sm font-body font-medium text-success">
                            🎉 Great news! You&apos;re on track to exceed your goal at your current pace.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-gray-100 pt-6">
                      <h3 className="text-sm font-body font-medium text-text-primary mb-3">
                        Is this achievable?
                      </h3>
                      {aiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                        </div>
                      ) : result.explanation ? (
                        <p className="text-sm font-body text-text-secondary leading-relaxed">
                          {result.explanation}
                        </p>
                      ) : (
                        <p className="text-sm font-body text-text-muted italic">
                          AI insights temporarily unavailable
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? 'Saving...' : 'Save Scenario'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleReset}
                      className="flex-1"
                    >
                      Try Different Numbers
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background mb-4">
                    <Flag className="w-8 h-8 text-text-muted" />
                  </div>
                  <h3 className="text-lg font-display text-text-primary mb-2">
                    Ready to plan
                  </h3>
                  <p className="text-sm text-text-secondary font-body">
                    Enter your annual goal on the left to see your monthly targets
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
