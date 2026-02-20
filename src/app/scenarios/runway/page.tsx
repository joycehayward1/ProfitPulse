"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { generateScenarioExplanation } from "@/lib/ai-insights";
import { ArrowLeft, Hourglass, TrendingUp, AlertCircle } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface RunwayResult {
  currentCash: number;
  monthlyBurn: number;
  runwayMonths: number;
  status: "healthy" | "attention" | "critical";
  explanation: string | null;
}

interface ShortfallResult {
  missedAmount: number;
  recoveryMonths: number;
  extraMonthly: number;
  explanation: string | null;
}

export default function RunwayPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useRequireAuth();

  // Cash Runway inputs
  const [currentCash, setCurrentCash] = useState("");
  const [monthlyBurn, setMonthlyBurn] = useState("");
  const [runwayResult, setRunwayResult] = useState<RunwayResult | null>(null);
  const [runwayAiLoading, setRunwayAiLoading] = useState(false);
  const [runwaySaving, setRunwaySaving] = useState(false);

  // Shortfall Recovery inputs
  const [missedAmount, setMissedAmount] = useState("");
  const [recoveryMonths, setRecoveryMonths] = useState("");
  const [shortfallResult, setShortfallResult] = useState<ShortfallResult | null>(null);
  const [shortfallAiLoading, setShortfallAiLoading] = useState(false);
  const [shortfallSaving, setShortfallSaving] = useState(false);

  useEffect(() => {
    async function loadFinancialData() {
      if (!user) return;

      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();

        const { data, error } = await client.database
          .from('financial_data')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        if (data) {
          setCurrentCash(data.cash_balance.toString());
          setMonthlyBurn(data.expenses.toString());
        }
      } catch (error) {
        console.error('Error loading financial data:', error);
      }
    }

    loadFinancialData();
  }, [user]);

  const handleRunwayCalculate = async () => {
    const cash = parseFloat(currentCash);
    const burn = parseFloat(monthlyBurn);

    if (!cash || cash <= 0) {
      showToast('error', 'Please enter a valid cash amount');
      return;
    }

    if (!burn || burn <= 0) {
      showToast('error', 'Please enter a valid monthly burn rate');
      return;
    }

    const runway = cash / burn;

    let status: "healthy" | "attention" | "critical";
    if (runway > 6) {
      status = "healthy";
    } else if (runway >= 3) {
      status = "attention";
    } else {
      status = "critical";
    }

    setRunwayResult({
      currentCash: cash,
      monthlyBurn: burn,
      runwayMonths: runway,
      status,
      explanation: null,
    });

    // Generate AI explanation
    setRunwayAiLoading(true);
    const aiExplanation = await generateScenarioExplanation(
      "runway",
      { currentCash: cash, monthlyBurn: burn },
      { runwayMonths: runway, status }
    );

    setRunwayResult(prev => prev ? { ...prev, explanation: aiExplanation } : null);
    setRunwayAiLoading(false);
  };

  const handleShortfallCalculate = async () => {
    const missed = parseFloat(missedAmount);
    const months = parseFloat(recoveryMonths);

    if (!missed || missed <= 0) {
      showToast('error', 'Please enter a valid shortfall amount');
      return;
    }

    if (!months || months <= 0) {
      showToast('error', 'Please enter valid recovery months');
      return;
    }

    const extra = missed / months;

    setShortfallResult({
      missedAmount: missed,
      recoveryMonths: months,
      extraMonthly: extra,
      explanation: null,
    });

    // Generate AI explanation
    setShortfallAiLoading(true);
    const aiExplanation = await generateScenarioExplanation(
      "runway",
      { missedAmount: missed, recoveryMonths: months },
      { extraMonthly: extra }
    );

    setShortfallResult(prev => prev ? { ...prev, explanation: aiExplanation } : null);
    setShortfallAiLoading(false);
  };

  const handleSaveRunway = async () => {
    if (!runwayResult || !user) return;

    setRunwaySaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { error } = await client.database
        .from('scenarios')
        .insert([{
          user_id: user.id,
          scenario_type: 'runway',
          inputs: {
            currentCash: runwayResult.currentCash,
            monthlyBurn: runwayResult.monthlyBurn,
          },
          result: {
            runwayMonths: runwayResult.runwayMonths,
            status: runwayResult.status,
            summary: `You can operate for ${runwayResult.runwayMonths.toFixed(1)} months at current spending`,
          },
          ai_explanation: runwayResult.explanation,
        }]);

      if (error) throw error;

      showToast('success', 'Cash runway scenario saved');
      router.push('/scenarios');
    } catch (error) {
      console.error('Error saving scenario:', error);
      showToast('error', 'Failed to save scenario');
    } finally {
      setRunwaySaving(false);
    }
  };

  const handleSaveShortfall = async () => {
    if (!shortfallResult || !user) return;

    setShortfallSaving(true);
    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      const { error } = await client.database
        .from('scenarios')
        .insert([{
          user_id: user.id,
          scenario_type: 'runway',
          inputs: {
            missedAmount: shortfallResult.missedAmount,
            recoveryMonths: shortfallResult.recoveryMonths,
          },
          result: {
            extraMonthly: shortfallResult.extraMonthly,
            summary: `To make up the shortfall, you need an extra $${Math.round(shortfallResult.extraMonthly).toLocaleString()}/month`,
          },
          ai_explanation: shortfallResult.explanation,
        }]);

      if (error) throw error;

      showToast('success', 'Recovery plan saved');
      router.push('/scenarios');
    } catch (error) {
      console.error('Error saving scenario:', error);
      showToast('error', 'Failed to save scenario');
    } finally {
      setShortfallSaving(false);
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <button
              onClick={() => router.push('/scenarios')}
              className="group flex items-center gap-2 text-text-secondary hover:text-orange transition-colors mb-6"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="font-body text-sm">Back to Scenarios</span>
            </button>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center">
                <Hourglass className="w-6 h-6 text-orange" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-2">
                  Cash Runway & Recovery
                </h1>
                <p className="text-text-secondary font-body">
                  Check how long your cash will last and plan recovery from missed targets.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12 space-y-12">
          {/* SECTION 1: Cash Runway */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Hourglass className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-display text-text-primary">Cash Runway</h2>
                <p className="text-sm text-text-secondary font-body">
                  How long can you operate at current spending?
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Runway Input */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-body font-medium text-text-primary mb-2">
                      Current cash on hand
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                        $
                      </span>
                      <input
                        type="number"
                        value={currentCash}
                        onChange={(e) => setCurrentCash(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                        placeholder="50,000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-body font-medium text-text-primary mb-2">
                      Monthly burn rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                        $
                      </span>
                      <input
                        type="number"
                        value={monthlyBurn}
                        onChange={(e) => setMonthlyBurn(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                        placeholder="8,000"
                      />
                    </div>
                    <p className="text-xs text-text-muted font-body mt-1">
                      Your total monthly expenses
                    </p>
                  </div>

                  <Button variant="primary" onClick={handleRunwayCalculate} className="w-full">
                    Calculate Runway
                  </Button>
                </div>
              </div>

              {/* Runway Result */}
              <div>
                {runwayResult ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-start justify-between mb-6">
                      <h3 className="text-lg font-display text-text-primary">Your Runway</h3>
                      <StatusBadge status={runwayResult.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl p-6 mb-6">
                      <p className="text-sm font-body text-text-secondary mb-2">
                        You can operate for
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display text-accent">
                          {runwayResult.runwayMonths.toFixed(1)}
                        </span>
                        <span className="text-lg font-body text-text-secondary">
                          months
                        </span>
                      </div>
                      <p className="text-sm font-body text-text-secondary mt-2">
                        at current spending levels
                      </p>
                    </div>

                    {/* Timeline Visualization */}
                    <div className="mb-6">
                      <h4 className="text-sm font-body font-medium text-text-primary mb-4">
                        Timeline
                      </h4>
                      <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent/80 transition-all duration-700"
                          style={{
                            width: `${Math.min((runwayResult.runwayMonths / 12) * 100, 100)}%`
                          }}
                        />
                        {/* Milestone markers */}
                        <div className="absolute inset-0 flex items-center">
                          {[3, 6, 9, 12].map((month) => (
                            <div
                              key={month}
                              className="absolute h-full border-l-2 border-white/30"
                              style={{ left: `${(month / 12) * 100}%` }}
                            >
                              <span className="absolute top-1/2 -translate-y-1/2 left-2 text-xs font-body text-white/80">
                                {month}mo
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs font-body text-text-muted">
                        <span>Today</span>
                        <span>12 months</span>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-gray-100 pt-6 mb-6">
                      <h4 className="text-sm font-body font-medium text-text-primary mb-3">
                        What this means
                      </h4>
                      {runwayAiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                        </div>
                      ) : runwayResult.explanation ? (
                        <p className="text-sm font-body text-text-secondary leading-relaxed">
                          {runwayResult.explanation}
                        </p>
                      ) : (
                        <p className="text-sm font-body text-text-muted italic">
                          AI insights temporarily unavailable
                        </p>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleSaveRunway}
                      disabled={runwaySaving}
                      className="w-full"
                    >
                      {runwaySaving ? 'Saving...' : 'Save Runway Scenario'}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                    <Hourglass className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <p className="text-sm text-text-secondary font-body">
                      Enter your numbers to calculate runway
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-4 text-sm font-body text-text-muted">
                Recovery Planning
              </span>
            </div>
          </div>

          {/* SECTION 2: Shortfall Recovery */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-orange/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-orange" />
              </div>
              <div>
                <h2 className="text-2xl font-display text-text-primary">Shortfall Recovery</h2>
                <p className="text-sm text-text-secondary font-body">
                  Plan how to make up for missed revenue targets
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Shortfall Input */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-body font-medium text-text-primary mb-2">
                      Missed target amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-display text-lg">
                        $
                      </span>
                      <input
                        type="number"
                        value={missedAmount}
                        onChange={(e) => setMissedAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                        placeholder="15,000"
                      />
                    </div>
                    <p className="text-xs text-text-muted font-body mt-1">
                      How much you fell short of your goal
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-body font-medium text-text-primary mb-2">
                      Months to recover
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={recoveryMonths}
                      onChange={(e) => setRecoveryMonths(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg font-body text-text-primary focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      placeholder="3"
                    />
                    <p className="text-xs text-text-muted font-body mt-1">
                      Time frame to catch up
                    </p>
                  </div>

                  <Button variant="primary" onClick={handleShortfallCalculate} className="w-full">
                    Calculate Recovery Plan
                  </Button>
                </div>
              </div>

              {/* Shortfall Result */}
              <div>
                {shortfallResult ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
                    <div className="flex items-start gap-3 mb-6">
                      <AlertCircle className="w-5 h-5 text-orange flex-shrink-0 mt-0.5" />
                      <h3 className="text-lg font-display text-text-primary">Recovery Plan</h3>
                    </div>

                    {/* Main Result */}
                    <div className="bg-gradient-to-br from-orange/5 to-orange/10 rounded-xl p-6 mb-6">
                      <p className="text-sm font-body text-text-secondary mb-2">
                        To make up the shortfall, you need
                      </p>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-display text-orange">
                          {formatCurrency(shortfallResult.extraMonthly)}
                        </span>
                        <span className="text-lg font-body text-text-secondary">
                          /month
                        </span>
                      </div>
                      <p className="text-sm font-body text-text-secondary">
                        extra for the next {shortfallResult.recoveryMonths} months
                      </p>
                    </div>

                    {/* Recovery Breakdown */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                        <span className="text-sm font-body text-text-secondary">Total shortfall</span>
                        <span className="text-base font-display text-text-primary">
                          {formatCurrency(shortfallResult.missedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-background rounded-lg">
                        <span className="text-sm font-body text-text-secondary">Recovery period</span>
                        <span className="text-base font-display text-text-primary">
                          {shortfallResult.recoveryMonths} months
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange/10 to-transparent rounded-lg border-l-4 border-orange">
                        <span className="text-sm font-body font-medium text-text-primary">Extra needed/month</span>
                        <span className="text-lg font-display text-orange">
                          {formatCurrency(shortfallResult.extraMonthly)}
                        </span>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-gray-100 pt-6 mb-6">
                      <h4 className="text-sm font-body font-medium text-text-primary mb-3">
                        Recovery strategy
                      </h4>
                      {shortfallAiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                        </div>
                      ) : shortfallResult.explanation ? (
                        <p className="text-sm font-body text-text-secondary leading-relaxed">
                          {shortfallResult.explanation}
                        </p>
                      ) : (
                        <p className="text-sm font-body text-text-muted italic">
                          AI insights temporarily unavailable
                        </p>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleSaveShortfall}
                      disabled={shortfallSaving}
                      className="w-full"
                    >
                      {shortfallSaving ? 'Saving...' : 'Save Recovery Plan'}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                    <TrendingUp className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <p className="text-sm text-text-secondary font-body">
                      Enter your shortfall details to create a recovery plan
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
