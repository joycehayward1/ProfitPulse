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
import type { FinancialDefaults } from "@/lib/financial-defaults";
import { buildGoalBaseline, computeGoal, type GoalComputation } from "@/lib/goal-planning";
import { changeTone, listMonths, makeMonthKey, monthLabel, monthRangeLabel, normalizeMonthly } from "@/lib/financial-periods";
import { formatMoney, toInputValue } from "@/lib/format-money";

interface GoalResult extends GoalComputation {
  annualGoal: number;
  currentMonthlyRevenue: number;
  currentMonthlyExpenses: number;
  monthsRemaining: number;
  /** YTD figures exactly as typed (null when left blank). */
  enteredYtdRevenue: number | null;
  enteredYtdExpenses: number | null;
  explanation: string | null;
}

function parseAmount(value: string): number | null {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const [monthsRemaining, setMonthsRemaining] = useState(() => buildGoalBaseline(normalizeMonthly([])).monthsRemaining);
  const [defaults, setDefaults] = useState<FinancialDefaults | null>(null);
  const [edited, setEdited] = useState<Record<string, boolean>>({});

  // Results
  const [result, setResult] = useState<GoalResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadFinancialData() {
      if (!user) return;

      try {
        const { loadFinancialDefaults } = await import("@/lib/financial-defaults");
        const loaded = await loadFinancialDefaults(user.id);
        setDefaults(loaded);

        // Pre-fill from the data the user already gave us. Everything stays editable.
        if (loaded.monthlyRevenue.value) setCurrentMonthly(toInputValue(loaded.monthlyRevenue.value));
        if (loaded.monthlyExpenses.value) setCurrentMonthlyExpenses(toInputValue(loaded.monthlyExpenses.value));
        if (loaded.goal.revenueSoFar) setYtdRevenue(toInputValue(loaded.goal.revenueSoFar));
        if (loaded.goal.expensesSoFar) setYtdExpenses(toInputValue(loaded.goal.expensesSoFar));
        setMonthsRemaining(loaded.goal.monthsRemaining);
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    }

    loadFinancialData();
  }, [user]);

  const baseline = defaults?.goal ?? null;
  const markEdited = (field: string) => setEdited((prev) => ({ ...prev, [field]: true }));

  const handleCalculate = async () => {
    const goal = parseFloat(annualGoal);
    const monthly = parseFloat(currentMonthly);
    const monthlyExpenses = parseFloat(currentMonthlyExpenses) || 0;
    const enteredYtdRevenue = parseAmount(ytdRevenue);
    const enteredYtdExpenses = parseAmount(ytdExpenses);
    const months = monthsRemaining;

    if (!goal || goal <= 0) {
      showToast('error', 'Please enter a valid annual goal');
      return;
    }

    if (!monthly || monthly <= 0) {
      showToast('error', 'Please enter your current monthly revenue');
      return;
    }

    if (!months || months <= 0 || months > 12) {
      showToast('error', 'Months remaining must be between 1 and 12');
      return;
    }

    const computed = computeGoal({
      annualGoal: goal,
      monthlyRevenue: monthly,
      monthlyExpenses,
      ytdRevenue: enteredYtdRevenue ?? 0,
      ytdExpenses: enteredYtdExpenses ?? 0,
      monthsRemaining: months,
    });

    setResult({
      ...computed,
      annualGoal: goal,
      currentMonthlyRevenue: monthly,
      currentMonthlyExpenses: monthlyExpenses,
      monthsRemaining: 12 - computed.monthsElapsed,
      enteredYtdRevenue,
      enteredYtdExpenses,
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
        ytdRevenue: computed.revenueSoFar,
        ytdExpenses: computed.expensesSoFar,
        monthsRemaining: 12 - computed.monthsElapsed,
      },
      {
        requiredMonthly: computed.requiredMonthly,
        progressPercent: computed.progressPercent,
        growthRequired: computed.growthRequired,
        currentMonthlyProfit: computed.currentMonthlyProfit,
        ytdProfit: computed.ytdProfit,
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
            ytdRevenue: result.enteredYtdRevenue,
            ytdExpenses: result.enteredYtdExpenses,
            monthsRemaining: result.monthsRemaining,
          },
          result: {
            requiredMonthly: result.requiredMonthly,
            progressPercent: result.progressPercent,
            currentMonthlyProfit: result.currentMonthlyProfit,
            ytdProfit: result.ytdProfit,
            revenueSoFar: result.revenueSoFar,
            revenueSoFarSource: result.revenueSoFarSource,
            expensesSoFar: result.expensesSoFar,
            expensesSoFarSource: result.expensesSoFarSource,
            monthsElapsed: result.monthsElapsed,
            status: result.status,
            summary: `To hit ${formatMoney(result.annualGoal)} by year-end, you need ${formatMoney(Math.round(result.requiredMonthly))}/month`,
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

  const formatCurrency = formatMoney;

  const ytdHint = (() => {
    if (!baseline || baseline.source === "none") return "Add up your income since January 1 — leave blank to estimate it from your monthly figure";
    if (baseline.source === "entered_ytd") return "The year-to-date figure you entered — adjust if needed";
    const covered = baseline.coveredThrough ? monthRangeLabel(makeMonthKey(baseline.year, 1), baseline.coveredThrough) : "";
    return `Added up from your saved months, ${covered} — adjust if needed`;
  })();

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F8F8F8] pb-16">
        {/* Header */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <button
            onClick={() => router.push('/scenarios')}
            className="flex items-center gap-2 text-[#8B8B8B] hover:text-[#111111] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back to Scenarios</span>
          </button>

          <h1 className="text-[28px] font-bold text-[#111111] mb-1">
            Goal Planning
          </h1>
          <p className="text-[14px] text-[#4B4B4B]">
            Plan your revenue targets and monthly goals to hit your annual number.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-[#111111] mb-4">
                Your Goal
              </h2>

              <div className="space-y-5">
                {/* Annual Revenue Goal */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Annual revenue goal
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={annualGoal}
                      onChange={(e) => setAnnualGoal(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="500,000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    Where you want to be by fiscal year-end
                  </p>
                </div>

                {/* Current Monthly Revenue */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Current monthly revenue
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={currentMonthly}
                      onChange={(e) => { setCurrentMonthly(e.target.value); markEdited("monthly"); }}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="35,000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    {!edited.monthly && defaults?.monthlyRevenue.source
                      ? `Pre-filled with your ${defaults.monthlyRevenue.source} — adjust if needed`
                      : "Auto-filled from your average monthly revenue when you have data — adjust if needed"}
                  </p>
                </div>

                {/* Current Monthly Expenses */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Current monthly expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={currentMonthlyExpenses}
                      onChange={(e) => { setCurrentMonthlyExpenses(e.target.value); markEdited("expenses"); }}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="20,000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    {!edited.expenses && defaults?.monthlyExpenses.source
                      ? `Pre-filled with your ${defaults.monthlyExpenses.source} — adjust if needed`
                      : "Auto-filled from your average monthly expenses when you have data — adjust if needed"}
                  </p>
                </div>

                {/* YTD Revenue */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Year-to-date revenue
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={ytdRevenue}
                      onChange={(e) => { setYtdRevenue(e.target.value); markEdited("ytdRevenue"); }}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="70,000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    {edited.ytdRevenue ? "Your figure — leave blank to estimate it from your monthly revenue" : ytdHint}
                  </p>
                </div>

                {/* YTD Expenses */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Year-to-date expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={ytdExpenses}
                      onChange={(e) => { setYtdExpenses(e.target.value); markEdited("ytdExpenses"); }}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="40,000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    {edited.ytdExpenses ? "Your figure — leave blank to estimate it from your monthly expenses" : ytdHint}
                  </p>
                </div>

                {baseline && (baseline.missingMonths.length > 0 || baseline.unsavedPastMonths.length > 0) && (
                  <div data-testid="ytd-coverage" className="rounded-lg bg-[#FFF7F2] border border-[#FCD9C2] p-3 space-y-1">
                    {baseline.missingMonths.length > 0 && (
                      <p className="text-[12px] text-[#4B4B4B]">
                        {listMonths(baseline.missingMonths)} {baseline.missingMonths.length === 1 ? "isn't" : "aren't"} saved, so {baseline.missingMonths.length === 1 ? "it is" : "they are"} not in the year-to-date total.
                      </p>
                    )}
                    {baseline.unsavedPastMonths.length > 0 && baseline.coveredThrough && (
                      <p className="text-[12px] text-[#4B4B4B]">
                        {monthRangeLabel(baseline.unsavedPastMonths[0], baseline.unsavedPastMonths[baseline.unsavedPastMonths.length - 1])}{" "}
                        {baseline.unsavedPastMonths.length === 1 ? "is" : "are"} over but not saved yet. Year to date runs through {monthLabel(baseline.coveredThrough)}, so the target assumes nothing was earned since. Save those months on the Data page for an accurate target.
                      </p>
                    )}
                  </div>
                )}

                {/* Months Remaining in Fiscal Year */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Months remaining in fiscal year
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={monthsRemaining}
                    onChange={(e) => setMonthsRemaining(parseInt(e.target.value) || 0)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                    placeholder="6"
                  />
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    {monthsRemaining >= 1 && monthsRemaining <= 12
                      ? `${12 - monthsRemaining} of 12 months done, ${monthsRemaining} left including this one. Uses the calendar year (January–December); adjust if your year ends differently.`
                      : "Enter a number from 1 to 12"}
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
                  <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                    <div className="flex items-start justify-between mb-6">
                      <h2 className="text-[16px] font-semibold text-[#111111]">
                        Your Path Forward
                      </h2>
                      <StatusBadge status={result.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-[#FFF7F2] rounded-xl p-6 mb-6">
                      <p className="text-[13px] text-[#4B4B4B] mb-2">
                        To hit <span className="font-semibold text-[#111111]">{formatCurrency(result.annualGoal)}</span> by year-end:
                      </p>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[24px] font-semibold text-[#E65100] tabular-nums">
                          {formatCurrency(result.requiredMonthly)}
                        </span>
                        <span className="text-[14px] text-[#4B4B4B]">
                          /month
                        </span>
                      </div>
                      <p className="text-[13px] text-[#4B4B4B]">
                        for the next <span className="font-semibold">{result.monthsRemaining} months</span>
                      </p>
                    </div>

                    {/* Progress Visualization */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-medium text-[#111111]">
                          Year-to-date progress
                        </h3>
                        <span className="text-[13px] font-semibold text-[#111111] tabular-nums">
                          {Math.round(result.progressPercent)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-3 bg-[#F4F4F5] rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full bg-[#E65100] rounded-full"
                          style={{ width: `${Math.min(result.progressPercent, 100)}%` }}
                        />
                      </div>

                      {/* Financial Snapshot */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">Monthly revenue</p>
                          <p className="text-[16px] font-semibold text-[#111111] tabular-nums">
                            {formatCurrency(result.currentMonthlyRevenue)}
                          </p>
                        </div>
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">Monthly expenses</p>
                          <p className="text-[16px] font-semibold text-[#111111] tabular-nums">
                            {formatCurrency(result.currentMonthlyExpenses)}
                          </p>
                        </div>
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">YTD revenue</p>
                          <p className="text-[16px] font-semibold text-[#111111] tabular-nums">
                            {formatCurrency(result.revenueSoFar)}
                          </p>
                          {result.revenueSoFarSource === "estimated" && (
                            <p className="text-[11px] text-[#8B8B8B]">Estimate: monthly × {result.monthsElapsed} months</p>
                          )}
                        </div>
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">YTD expenses</p>
                          <p className="text-[16px] font-semibold text-[#111111] tabular-nums">
                            {formatCurrency(result.expensesSoFar)}
                          </p>
                          {result.expensesSoFarSource === "estimated" && (
                            <p className="text-[11px] text-[#8B8B8B]">Estimate: monthly × {result.monthsElapsed} months</p>
                          )}
                        </div>
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">Monthly profit</p>
                          <p className={`text-[16px] font-semibold tabular-nums ${result.currentMonthlyProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {formatCurrency(result.currentMonthlyProfit)}
                          </p>
                        </div>
                        <div className="bg-[#F4F4F5] rounded-lg p-3">
                          <p className="text-[12px] text-[#8B8B8B] mb-0.5">Need to hit</p>
                          <p className="text-[16px] font-semibold text-[#E65100] tabular-nums">
                            {formatCurrency(result.requiredMonthly)}
                          </p>
                        </div>
                      </div>

                      {/* Growth indicator */}
                      {result.requiredMonthly > result.currentMonthlyRevenue && (
                        <div className="mt-4 p-3 bg-[#FFF7F2] rounded-lg border-l-3 border-[#E65100]">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-[#E65100]" />
                            <p className="text-[13px] font-medium text-[#111111]">
                              Growth needed
                            </p>
                          </div>
                          <p className="text-[13px] text-[#4B4B4B]">
                            You need to grow by{' '}
                            <span className="font-semibold text-[#E65100]">
                              {formatCurrency(result.requiredMonthly - result.currentMonthlyRevenue)}/month
                            </span>
                            {result.growthRequired !== null && <>{' '}({Math.round(result.growthRequired)}% increase)</>}
                          </p>
                        </div>
                      )}

                      {result.requiredMonthly <= result.currentMonthlyRevenue && (
                        <div className="mt-4 p-3 bg-[#F0FDF4] rounded-lg border-l-3 border-[#16A34A]">
                          <p className="text-[13px] font-medium text-[#16A34A]">
                            Great news! You&apos;re on track to exceed your goal at your current pace.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-[#F0F0F2] pt-5">
                      <h3 className="text-[13px] font-medium text-[#111111] mb-2">
                        Is this achievable?
                      </h3>
                      {aiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-full" />
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-5/6" />
                        </div>
                      ) : result.explanation ? (
                        <p className="text-[13px] text-[#4B4B4B] leading-relaxed">
                          {result.explanation}
                        </p>
                      ) : (
                        <p className="text-[13px] text-[#8B8B8B] italic">
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
                <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#F4F4F5] mb-4">
                    <Flag className="w-6 h-6 text-[#8B8B8B]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                    Ready to plan
                  </h3>
                  <p className="text-[13px] text-[#4B4B4B]">
                    Enter your annual goal on the left to see your monthly targets
                  </p>
                </div>
              )}
            </div>
          </div>

          {baseline && baseline.months.length > 0 && (
            <div data-testid="goal-months" className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-[#111111]">Month by month, {baseline.year}</h2>
              <p className="text-[12px] text-[#8B8B8B] mt-0.5 mb-4">
                Income from your saved months, with each month compared with the one before and the running total since January.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F0F0F2] text-[11px] uppercase tracking-wider text-[#8B8B8B]">
                      <th className="text-left py-2 pr-3 font-semibold">Month</th>
                      <th className="text-right py-2 px-3 font-semibold">Income</th>
                      <th className="text-right py-2 px-3 font-semibold">vs month before</th>
                      <th className="text-right py-2 pl-3 font-semibold">Running total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseline.months.map((m) => {
                      const tone = changeTone(m.changeFromPrevious, true);
                      return (
                        <tr key={m.month} className="border-b border-[#F0F0F2] last:border-b-0">
                          <td className="py-2 pr-3 text-[#111111]">{monthLabel(m.month)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#111111]">
                            {m.income === null ? <span className="text-[#8B8B8B]">Not saved</span> : formatCurrency(m.income)}
                          </td>
                          <td className={`py-2 px-3 text-right tabular-nums ${tone === "good" ? "text-[#16A34A]" : tone === "bad" ? "text-[#DC2626]" : "text-[#8B8B8B]"}`}>
                            {m.changeFromPrevious === null
                              ? "—"
                              : `${m.changeFromPrevious > 0 ? "▲" : m.changeFromPrevious < 0 ? "▼" : ""} ${Math.abs(m.changeFromPrevious).toFixed(1)}%`}
                          </td>
                          <td className="py-2 pl-3 text-right tabular-nums font-medium text-[#111111]">{formatCurrency(m.cumulative)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
