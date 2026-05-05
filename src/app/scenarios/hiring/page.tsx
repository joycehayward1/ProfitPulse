"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { generateScenarioExplanation } from "@/lib/ai-insights";
import { ArrowLeft, UserPlus, CheckCircle, XCircle } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface HiringResult {
  canAfford: boolean;
  monthlyCost: number;
  currentProfit: number;
  afterHiringProfit: number;
  explanation: string | null;
  monthsToWait: number;
}

export default function HiringPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useRequireAuth();

  // Form inputs
  const [annualSalary, setAnnualSalary] = useState("");
  const [monthsToHire, setMonthsToHire] = useState(0);
  const [currentProfit, setCurrentProfit] = useState(0);

  // Results
  const [result, setResult] = useState<HiringResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-calculate benefits (25% of salary)
  const benefits = annualSalary ? Math.round(parseFloat(annualSalary) * 0.25) : 0;
  const totalCompensation = annualSalary ? parseFloat(annualSalary) + benefits : 0;

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
          const profit = (data.total_income ?? 0) - (data.total_expenses ?? 0);
          setCurrentProfit(profit);
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
          const fallbackProfit =
            (assessment.monthly_revenue || 0) - (assessment.monthly_expenses || 0);
          setCurrentProfit(fallbackProfit);
        } else if (error) {
          throw error;
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    }

    loadFinancialData();
  }, [user]);

  const handleCalculate = async () => {
    const salary = parseFloat(annualSalary);

    if (!salary || salary <= 0) {
      showToast('error', 'Please enter a valid annual salary');
      return;
    }

    const monthlyCost = totalCompensation / 12;
    const afterHiringProfit = currentProfit - monthlyCost;
    const canAfford = afterHiringProfit > 0;

    setResult({
      canAfford,
      monthlyCost,
      currentProfit,
      afterHiringProfit,
      explanation: null,
      monthsToWait: monthsToHire,
    });

    // Generate AI explanation
    setAiLoading(true);
    const aiExplanation = await generateScenarioExplanation(
      "hiring",
      {
        annualSalary: salary,
        benefits,
        monthsToHire,
        currentProfit,
      },
      {
        canAfford,
        monthlyCost,
        afterHiringProfit,
      }
    );

    setResult(prev => prev ? { ...prev, explanation: aiExplanation } : null);
    setAiLoading(false);
  };

  const handleReset = () => {
    setAnnualSalary("");
    setMonthsToHire(0);
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
          scenario_type: 'hiring',
          inputs: {
            annualSalary: parseFloat(annualSalary),
            benefits,
            monthsToHire: result.monthsToWait,
            currentProfit,
          },
          result: {
            canAfford: result.canAfford,
            monthlyCost: result.monthlyCost,
            afterHiringProfit: result.afterHiringProfit,
            summary: result.canAfford
              ? 'Yes, you can afford to hire!'
              : 'Not yet—here\'s what needs to change',
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
            Can I Hire?
          </h1>
          <p className="text-[14px] text-[#4B4B4B]">
            See if you can afford to bring on new help.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-[#111111] mb-4">
                New Employee Details
              </h2>

              <div className="space-y-5">
                {/* Annual Salary */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Annual salary
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={annualSalary}
                      onChange={(e) => setAnnualSalary(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="45,000"
                    />
                  </div>
                </div>

                {/* Benefits & Overhead (Auto-calculated) */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Benefits & overhead (25%)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="text"
                      value={benefits.toLocaleString()}
                      disabled
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#8B8B8B] bg-[#F4F4F5] cursor-not-allowed"
                      placeholder="11,250"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    Automatically calculated at 25% of base salary
                  </p>
                </div>

                {/* Hiring Timeline Slider */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    When do you want to hire?
                  </label>
                  <div className="space-y-3">
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={monthsToHire}
                      onChange={(e) => setMonthsToHire(parseInt(e.target.value))}
                      className="w-full h-2 bg-[#E4E4E7] rounded-full appearance-none cursor-pointer accent-[#E65100]"
                    />
                    <div className="flex items-center justify-between text-[12px] text-[#8B8B8B]">
                      <span>Now</span>
                      <span className="text-[#E65100] font-medium text-[14px]">
                        {monthsToHire === 0 ? 'Now' : monthsToHire === 1 ? '1 month' : `${monthsToHire} months`}
                      </span>
                      <span>12 months</span>
                    </div>
                  </div>
                </div>

                {/* Total Compensation Preview */}
                {totalCompensation > 0 && (
                  <div className="bg-[#F4F4F5] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-[#4B4B4B]">
                        Total annual cost
                      </span>
                      <span className="text-[16px] font-semibold text-[#111111] tabular-nums">
                        {formatCurrency(totalCompensation)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-[#4B4B4B]">
                        Monthly cost
                      </span>
                      <span className="text-[14px] font-semibold text-[#E65100] tabular-nums">
                        {formatCurrency(totalCompensation / 12)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Calculate Button */}
                <Button
                  variant="primary"
                  onClick={handleCalculate}
                  className="w-full"
                >
                  Check Affordability
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
                        The Verdict
                      </h2>
                      <StatusBadge
                        status={result.canAfford ? "healthy" : "critical"}
                      />
                    </div>

                    {/* Main Result */}
                    <div className={`rounded-xl p-5 mb-6 ${
                      result.canAfford ? 'bg-[#F0FDF4]' : 'bg-[#FEF2F2]'
                    }`}>
                      <div className="flex items-start gap-3">
                        {result.canAfford ? (
                          <CheckCircle className="w-6 h-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-6 h-6 text-[#DC2626] flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h3 className={`text-[16px] font-semibold mb-1 ${
                            result.canAfford ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}>
                            {result.canAfford
                              ? 'Yes, you can afford to hire!'
                              : 'Not yet—here\'s what needs to change'}
                          </h3>
                          <p className="text-[13px] text-[#4B4B4B]">
                            {result.canAfford
                              ? `You'll still have ${formatCurrency(result.afterHiringProfit)}/month in profit`
                              : `You need ${formatCurrency(Math.abs(result.afterHiringProfit))}/month more in profit`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Profit Comparison Chart */}
                    <div className="mb-6">
                      <h3 className="text-[13px] font-medium text-[#111111] mb-3">
                        Profit Comparison
                      </h3>
                      <div className="space-y-4">
                        {/* Current Monthly Profit */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-[#4B4B4B]">
                              Current Monthly Profit
                            </span>
                            <span className="text-[14px] font-semibold text-[#111111] tabular-nums">
                              {formatCurrency(result.currentProfit)}
                            </span>
                          </div>
                          <div className="h-3 bg-[#F4F4F5] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#16A34A] rounded-full"
                              style={{
                                width: `${Math.min((result.currentProfit / Math.max(result.currentProfit, 1)) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {/* After Hiring */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[13px] text-[#4B4B4B]">
                              After Hiring
                            </span>
                            <span className={`text-[14px] font-semibold tabular-nums ${
                              result.afterHiringProfit > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}>
                              {formatCurrency(result.afterHiringProfit)}
                            </span>
                          </div>
                          <div className="h-3 bg-[#F4F4F5] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                result.afterHiringProfit > 0 ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
                              }`}
                              style={{
                                width: result.afterHiringProfit > 0
                                  ? `${Math.min((result.afterHiringProfit / Math.max(result.currentProfit, 1)) * 100, 100)}%`
                                  : '0%'
                              }}
                            />
                          </div>
                        </div>

                        {/* Difference indicator */}
                        <div className="pt-3 border-t border-[#F0F0F2]">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-[#4B4B4B]">Monthly cost of hire</span>
                            <span className="font-semibold text-[#E65100] tabular-nums">
                              -{formatCurrency(result.monthlyCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-[#F0F0F2] pt-5">
                      <h3 className="text-[13px] font-medium text-[#111111] mb-2">
                        What this means
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
                    <UserPlus className="w-6 h-6 text-[#8B8B8B]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                    Ready to calculate
                  </h3>
                  <p className="text-[13px] text-[#4B4B4B]">
                    Enter the salary details on the left to see if you can afford to hire
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
