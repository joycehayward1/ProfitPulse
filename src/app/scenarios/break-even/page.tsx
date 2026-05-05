"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { generateScenarioExplanation } from "@/lib/ai-insights";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface BreakEvenResult {
  breakEvenUnits: number;
  currentSales: number;
  status: "healthy" | "attention" | "critical";
  explanation: string | null;
}

export default function BreakEvenPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useRequireAuth();

  // Form inputs
  const [fixedExpenses, setFixedExpenses] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [variableCost, setVariableCost] = useState("");
  const [currentSales, setCurrentSales] = useState("");

  // Results
  const [result, setResult] = useState<BreakEvenResult | null>(null);
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
          setFixedExpenses((data.total_expenses ?? 0).toString());
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
          setFixedExpenses((assessment.monthly_expenses || 0).toString());
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
    const fixed = parseFloat(fixedExpenses);
    const price = parseFloat(pricePerUnit);
    const variable = parseFloat(variableCost);
    const sales = parseFloat(currentSales) || 0;

    if (!fixed || !price || !variable) {
      showToast('error', 'Please fill in all fields');
      return;
    }

    if (price <= variable) {
      showToast('error', 'Price must be greater than variable cost');
      return;
    }

    const breakEvenUnits = Math.ceil(fixed / (price - variable));

    // Determine status
    let status: "healthy" | "attention" | "critical";
    const difference = sales - breakEvenUnits;
    const percentAbove = (difference / breakEvenUnits) * 100;

    if (percentAbove >= 20) {
      status = "healthy";
    } else if (percentAbove >= -10) {
      status = "attention";
    } else {
      status = "critical";
    }

    setResult({
      breakEvenUnits,
      currentSales: sales,
      status,
      explanation: null,
    });

    // Generate AI explanation
    setAiLoading(true);
    const aiExplanation = await generateScenarioExplanation(
      "break-even",
      {
        fixedExpenses: fixed,
        pricePerUnit: price,
        variableCost: variable,
        currentSales: sales,
      },
      {
        breakEvenUnits,
        status,
      }
    );

    setResult(prev => prev ? { ...prev, explanation: aiExplanation } : null);
    setAiLoading(false);
  };

  const handleReset = () => {
    setPricePerUnit("");
    setVariableCost("");
    setCurrentSales("");
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
          scenario_type: 'break-even',
          inputs: {
            fixedExpenses: parseFloat(fixedExpenses),
            pricePerUnit: parseFloat(pricePerUnit),
            variableCost: parseFloat(variableCost),
            currentSales: parseFloat(currentSales) || 0,
          },
          result: {
            breakEvenUnits: result.breakEvenUnits,
            status: result.status,
            summary: `You need to sell ${result.breakEvenUnits} units per month to break even`,
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
            Break-Even Calculator
          </h1>
          <p className="text-[14px] text-[#4B4B4B]">
            Calculate the exact sales level you need to cover your costs.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
              <h2 className="text-[16px] font-semibold text-[#111111] mb-4">
                Your Numbers
              </h2>

              <div className="space-y-5">
                {/* Fixed Expenses */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Monthly Fixed Expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      name="fixedExpenses"
                      value={fixedExpenses}
                      onChange={(e) => setFixedExpenses(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="5000"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    Rent, salaries, utilities—costs that don&apos;t change with sales
                  </p>
                </div>

                {/* Price Per Unit */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Average Price per Service/Product
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      name="pricePerUnit"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="150"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    What you charge customers on average
                  </p>
                </div>

                {/* Variable Cost */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Variable Cost per Service/Product
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      name="variableCost"
                      value={variableCost}
                      onChange={(e) => setVariableCost(e.target.value)}
                      className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="50"
                    />
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    Materials, labor, costs that increase with each sale
                  </p>
                </div>

                {/* Current Sales (Optional) */}
                <div>
                  <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                    Current Monthly Sales <span className="text-[#8B8B8B]">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="currentSales"
                      value={currentSales}
                      onChange={(e) => setCurrentSales(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-[13px]">
                      units
                    </span>
                  </div>
                  <p className="text-[12px] text-[#8B8B8B] mt-1">
                    How many you&apos;re selling now (for comparison)
                  </p>
                </div>

                {/* Calculate Button */}
                <Button
                  variant="primary"
                  onClick={handleCalculate}
                  className="w-full"
                >
                  Calculate Break-Even Point
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
                        Your Break-Even Point
                      </h2>
                      <StatusBadge status={result.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-[#FFF7F2] rounded-xl p-6 mb-6">
                      <p className="text-[13px] text-[#4B4B4B] mb-2">
                        You need to sell
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[24px] font-semibold text-[#E65100] tabular-nums">
                          {result.breakEvenUnits}
                        </span>
                        <span className="text-[14px] text-[#4B4B4B]">
                          units/month
                        </span>
                      </div>
                      <p className="text-[13px] text-[#4B4B4B] mt-1">
                        to break even
                      </p>
                    </div>

                    {/* Visual Comparison */}
                    {result.currentSales > 0 && (
                      <div className="mb-6">
                        <h3 className="text-[13px] font-medium text-[#111111] mb-3">
                          Where you are now
                        </h3>
                        <div className="space-y-3">
                          {/* Current Sales Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[12px] text-[#4B4B4B]">
                                Current Sales
                              </span>
                              <span className="text-[13px] font-semibold text-[#111111] tabular-nums">
                                {result.currentSales} units
                              </span>
                            </div>
                            <div className="h-2.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#16A34A] rounded-full"
                                style={{
                                  width: `${Math.min((result.currentSales / Math.max(result.breakEvenUnits, result.currentSales)) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>

                          {/* Break-Even Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[12px] text-[#4B4B4B]">
                                Break-Even Point
                              </span>
                              <span className="text-[13px] font-semibold text-[#111111] tabular-nums">
                                {result.breakEvenUnits} units
                              </span>
                            </div>
                            <div className="h-2.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#E65100] rounded-full"
                                style={{
                                  width: `${Math.min((result.breakEvenUnits / Math.max(result.breakEvenUnits, result.currentSales)) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Gap indicator */}
                        <div className="mt-3 p-3 bg-[#F4F4F5] rounded-lg">
                          <p className="text-[13px] text-[#111111]">
                            {result.currentSales >= result.breakEvenUnits ? (
                              <>
                                You&apos;re <span className="font-semibold text-[#16A34A]">
                                  {result.currentSales - result.breakEvenUnits} units above
                                </span> break-even
                              </>
                            ) : (
                              <>
                                You need <span className="font-semibold text-[#E65100]">
                                  {result.breakEvenUnits - result.currentSales} more units
                                </span> to break even
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

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
                    <TrendingUp className="w-6 h-6 text-[#8B8B8B]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                    Ready to calculate
                  </h3>
                  <p className="text-[13px] text-[#4B4B4B]">
                    Enter your numbers on the left to see your break-even point
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
