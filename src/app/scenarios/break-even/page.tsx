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
                <TrendingUp className="w-6 h-6 text-orange" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-2">
                  Break-Even Calculator
                </h1>
                <p className="text-text-secondary font-body">
                  Calculate the exact sales level you need to cover your costs.
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
                Your Numbers
              </h2>

              <div className="space-y-6">
                {/* Fixed Expenses */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Monthly Fixed Expenses
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      name="fixedExpenses"
                      value={fixedExpenses}
                      onChange={(e) => setFixedExpenses(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="5000"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Rent, salaries, utilities—costs that don&apos;t change with sales
                  </p>
                </div>

                {/* Price Per Unit */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Average Price per Service/Product
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      name="pricePerUnit"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="150"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    What you charge customers on average
                  </p>
                </div>

                {/* Variable Cost */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Variable Cost per Service/Product
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                      $
                    </span>
                    <input
                      type="number"
                      name="variableCost"
                      value={variableCost}
                      onChange={(e) => setVariableCost(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="50"
                    />
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
                    Materials, labor, costs that increase with each sale
                  </p>
                </div>

                {/* Current Sales (Optional) */}
                <div>
                  <label className="block text-sm font-body font-medium text-text-primary mb-2">
                    Current Monthly Sales <span className="text-text-muted">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="currentSales"
                      value={currentSales}
                      onChange={(e) => setCurrentSales(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="40"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-body text-sm">
                      units
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-body mt-1">
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
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-start justify-between mb-6">
                      <h2 className="text-xl font-display text-text-primary">
                        Your Break-Even Point
                      </h2>
                      <StatusBadge status={result.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-gradient-to-br from-orange/5 to-orange/10 rounded-xl p-6 mb-6">
                      <p className="text-sm font-body text-text-secondary mb-2">
                        You need to sell
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display text-orange">
                          {result.breakEvenUnits}
                        </span>
                        <span className="text-lg font-body text-text-secondary">
                          units/month
                        </span>
                      </div>
                      <p className="text-sm font-body text-text-secondary mt-2">
                        to break even
                      </p>
                    </div>

                    {/* Visual Comparison */}
                    {result.currentSales > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-body font-medium text-text-primary mb-4">
                          Where you are now
                        </h3>
                        <div className="space-y-3">
                          {/* Current Sales Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-body text-text-secondary">
                                Current Sales
                              </span>
                              <span className="text-sm font-display text-text-primary">
                                {result.currentSales} units
                              </span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-accent/60 to-accent transition-all duration-700"
                                style={{
                                  width: `${Math.min((result.currentSales / Math.max(result.breakEvenUnits, result.currentSales)) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>

                          {/* Break-Even Bar */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-body text-text-secondary">
                                Break-Even Point
                              </span>
                              <span className="text-sm font-display text-text-primary">
                                {result.breakEvenUnits} units
                              </span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange to-orange/80 transition-all duration-700"
                                style={{
                                  width: `${Math.min((result.breakEvenUnits / Math.max(result.breakEvenUnits, result.currentSales)) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Gap indicator */}
                        <div className="mt-4 p-4 bg-background rounded-lg">
                          <p className="text-sm font-body text-text-primary">
                            {result.currentSales >= result.breakEvenUnits ? (
                              <>
                                You&apos;re <span className="font-semibold text-success">
                                  {result.currentSales - result.breakEvenUnits} units above
                                </span> break-even 🎉
                              </>
                            ) : (
                              <>
                                You need <span className="font-semibold text-orange">
                                  {result.breakEvenUnits - result.currentSales} more units
                                </span> to break even
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

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
                    <TrendingUp className="w-8 h-8 text-text-muted" />
                  </div>
                  <h3 className="text-lg font-display text-text-primary mb-2">
                    Ready to calculate
                  </h3>
                  <p className="text-sm text-text-secondary font-body">
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
