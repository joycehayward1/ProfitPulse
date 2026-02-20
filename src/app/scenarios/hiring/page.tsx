"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { generateScenarioExplanation } from "@/lib/ai-insights";
import { ArrowLeft, UserPlus, CheckCircle, XCircle } from "lucide-react";

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
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();

        // TODO: Replace with actual auth
        const userId = "placeholder-user-id";

        const { data, error } = await client.database
          .from('financial_data')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        if (data) {
          const profit = data.revenue - data.expenses;
          setCurrentProfit(profit);
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    }

    loadFinancialData();
  }, []);

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
    if (!result) return;

    setSaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // TODO: Replace with actual auth
      const userId = "placeholder-user-id";

      const { error } = await client.database
        .from('scenarios')
        .insert([{
          user_id: userId,
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
                <UserPlus className="w-6 h-6 text-orange" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-2">
                  Can I Hire?
                </h1>
                <p className="text-text-secondary font-body">
                  See if you can afford to bring on new help.
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
                New Employee Details
              </h2>

              <div className="space-y-6">
                {/* Annual Salary */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Annual salary
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      value={annualSalary}
                      onChange={(e) => setAnnualSalary(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="45,000"
                    />
                  </div>
                </div>

                {/* Benefits & Overhead (Auto-calculated) */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Benefits & overhead (25%)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="text"
                      value={benefits.toLocaleString()}
                      disabled
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-muted bg-gray-50 cursor-not-allowed"
                      placeholder="11,250"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Automatically calculated at 25% of base salary
                  </p>
                </div>

                {/* Hiring Timeline Slider */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    When do you want to hire?
                  </label>
                  <div className="space-y-4">
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={monthsToHire}
                      onChange={(e) => setMonthsToHire(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #E65100 0%, #E65100 ${(monthsToHire / 12) * 100}%, #e5e7eb ${(monthsToHire / 12) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex items-center justify-between text-xs font-body text-text-muted">
                      <span>Now</span>
                      <span className="text-orange font-medium text-base">
                        {monthsToHire === 0 ? 'Now' : monthsToHire === 1 ? '1 month' : `${monthsToHire} months`}
                      </span>
                      <span>12 months</span>
                    </div>
                  </div>
                </div>

                {/* Total Compensation Preview */}
                {totalCompensation > 0 && (
                  <div className="bg-background rounded-lg p-4 border border-orange/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-body text-text-secondary">
                        Total annual cost
                      </span>
                      <span className="text-lg font-display text-text-primary">
                        {formatCurrency(totalCompensation)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-body text-text-secondary">
                        Monthly cost
                      </span>
                      <span className="text-base font-display text-orange">
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
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-start justify-between mb-6">
                      <h2 className="text-xl font-display text-text-primary">
                        The Verdict
                      </h2>
                      <StatusBadge
                        status={result.canAfford ? "healthy" : "critical"}
                      />
                    </div>

                    {/* Main Result */}
                    <div className={`rounded-xl p-6 mb-6 ${
                      result.canAfford
                        ? 'bg-gradient-to-br from-success/5 to-success/10'
                        : 'bg-gradient-to-br from-error/5 to-error/10'
                    }`}>
                      <div className="flex items-start gap-3 mb-3">
                        {result.canAfford ? (
                          <CheckCircle className="w-8 h-8 text-success flex-shrink-0" />
                        ) : (
                          <XCircle className="w-8 h-8 text-error flex-shrink-0" />
                        )}
                        <div>
                          <h3 className={`text-2xl font-display mb-1 ${
                            result.canAfford ? 'text-success' : 'text-error'
                          }`}>
                            {result.canAfford
                              ? 'Yes, you can afford to hire!'
                              : 'Not yet—here\'s what needs to change'}
                          </h3>
                          <p className="text-sm font-body text-text-secondary">
                            {result.canAfford
                              ? `You'll still have ${formatCurrency(result.afterHiringProfit)}/month in profit`
                              : `You need ${formatCurrency(Math.abs(result.afterHiringProfit))}/month more in profit`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Profit Comparison Chart */}
                    <div className="mb-6">
                      <h3 className="text-sm font-body font-medium text-text-primary mb-4">
                        Profit Comparison
                      </h3>
                      <div className="space-y-4">
                        {/* Current Monthly Profit */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-body text-text-secondary">
                              Current Monthly Profit
                            </span>
                            <span className="text-base font-display text-text-primary">
                              {formatCurrency(result.currentProfit)}
                            </span>
                          </div>
                          <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-accent to-accent/80 flex items-center justify-end pr-3 transition-all duration-700"
                              style={{
                                width: `${Math.min((result.currentProfit / Math.max(result.currentProfit, 1)) * 100, 100)}%`
                              }}
                            >
                              <span className="text-xs font-body text-white font-medium">
                                {formatCurrency(result.currentProfit)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* After Hiring */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-body text-text-secondary">
                              After Hiring
                            </span>
                            <span className={`text-base font-display ${
                              result.afterHiringProfit > 0 ? 'text-success' : 'text-error'
                            }`}>
                              {formatCurrency(result.afterHiringProfit)}
                            </span>
                          </div>
                          <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
                            <div
                              className={`h-full flex items-center justify-end pr-3 transition-all duration-700 ${
                                result.afterHiringProfit > 0
                                  ? 'bg-gradient-to-r from-success to-success/80'
                                  : 'bg-gradient-to-r from-error to-error/80'
                              }`}
                              style={{
                                width: result.afterHiringProfit > 0
                                  ? `${Math.min((result.afterHiringProfit / Math.max(result.currentProfit, 1)) * 100, 100)}%`
                                  : '0%'
                              }}
                            >
                              {result.afterHiringProfit > 0 && (
                                <span className="text-xs font-body text-white font-medium">
                                  {formatCurrency(result.afterHiringProfit)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Difference indicator */}
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between text-sm font-body">
                            <span className="text-text-secondary">Monthly cost of hire</span>
                            <span className="font-display text-orange">
                              -{formatCurrency(result.monthlyCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-gray-100 pt-6">
                      <h3 className="text-sm font-body font-medium text-text-primary mb-3">
                        What this means
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
                    <UserPlus className="w-8 h-8 text-text-muted" />
                  </div>
                  <h3 className="text-lg font-display text-text-primary mb-2">
                    Ready to calculate
                  </h3>
                  <p className="text-sm text-text-secondary font-body">
                    Enter the salary details on the left to see if you can afford to hire
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #E65100;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(230, 81, 0, 0.3);
          transition: transform 0.2s;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #E65100;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(230, 81, 0, 0.3);
        }

        .slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
      `}</style>
    </AppLayout>
  );
}
