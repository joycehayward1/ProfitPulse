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
          .from('financial_snapshots')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setCurrentCash((data.current_assets ?? 0).toString());
          setMonthlyBurn((data.total_expenses ?? 0).toString());
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
          setCurrentCash((assessment.cash_on_hand || 0).toString());
          setMonthlyBurn((assessment.monthly_expenses || 0).toString());
        } else if (error) {
          throw error;
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
      <div className="min-h-screen bg-[#F8F8F8] pb-16">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <button
            onClick={() => router.push('/scenarios')}
            className="flex items-center gap-2 text-[#8B8B8B] hover:text-[#111111] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[13px]">Back to Scenarios</span>
          </button>

          <h1 className="text-[28px] font-bold text-[#111111] mb-1">
            Cash Runway & Recovery
          </h1>
          <p className="text-[14px] text-[#4B4B4B]">
            Check how long your cash will last and plan recovery from missed targets.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
          {/* SECTION 1: Cash Runway */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#E65100]/10 flex items-center justify-center flex-shrink-0">
                <Hourglass className="w-5 h-5 text-[#E65100]" />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#111111]">Cash Runway</h2>
                <p className="text-[13px] text-[#4B4B4B]">
                  How long can you operate at current spending?
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Runway Input */}
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                      Current cash on hand
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={currentCash}
                        onChange={(e) => setCurrentCash(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                        placeholder="50,000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                      Monthly burn rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={monthlyBurn}
                        onChange={(e) => setMonthlyBurn(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                        placeholder="8,000"
                      />
                    </div>
                    <p className="text-[12px] text-[#8B8B8B] mt-1">
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
                  <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                    <div className="flex items-start justify-between mb-5">
                      <h3 className="text-[16px] font-semibold text-[#111111]">Your Runway</h3>
                      <StatusBadge status={runwayResult.status} />
                    </div>

                    {/* Main Result */}
                    <div className="bg-[#FFF7F2] rounded-xl p-5 mb-5">
                      <p className="text-[13px] text-[#4B4B4B] mb-1">
                        You can operate for
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[24px] font-semibold text-[#E65100] tabular-nums">
                          {runwayResult.runwayMonths.toFixed(1)}
                        </span>
                        <span className="text-[14px] text-[#4B4B4B]">
                          months
                        </span>
                      </div>
                      <p className="text-[13px] text-[#4B4B4B] mt-1">
                        at current spending levels
                      </p>
                    </div>

                    {/* Timeline Visualization */}
                    <div className="mb-5">
                      <h4 className="text-[13px] font-medium text-[#111111] mb-3">
                        Timeline
                      </h4>
                      <div className="relative h-3 bg-[#F4F4F5] rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-[#E65100] rounded-full"
                          style={{
                            width: `${Math.min((runwayResult.runwayMonths / 12) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[12px] text-[#8B8B8B]">
                        <span>Today</span>
                        <span>12 months</span>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-[#F0F0F2] pt-5 mb-5">
                      <h4 className="text-[13px] font-medium text-[#111111] mb-2">
                        What this means
                      </h4>
                      {runwayAiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-full" />
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-5/6" />
                        </div>
                      ) : runwayResult.explanation ? (
                        <p className="text-[13px] text-[#4B4B4B] leading-relaxed">
                          {runwayResult.explanation}
                        </p>
                      ) : (
                        <p className="text-[13px] text-[#8B8B8B] italic">
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
                  <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#F4F4F5] mb-4">
                      <Hourglass className="w-6 h-6 text-[#8B8B8B]" />
                    </div>
                    <p className="text-[13px] text-[#4B4B4B]">
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
              <div className="w-full border-t border-[#E4E4E7]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#F8F8F8] px-4 text-[13px] text-[#8B8B8B]">
                Recovery Planning
              </span>
            </div>
          </div>

          {/* SECTION 2: Shortfall Recovery */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#E65100]/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-[#E65100]" />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#111111]">Shortfall Recovery</h2>
                <p className="text-[13px] text-[#4B4B4B]">
                  Plan how to make up for missed revenue targets
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Shortfall Input */}
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                      Missed target amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8B8B] text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={missedAmount}
                        onChange={(e) => setMissedAmount(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                        placeholder="15,000"
                      />
                    </div>
                    <p className="text-[12px] text-[#8B8B8B] mt-1">
                      How much you fell short of your goal
                    </p>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#111111] mb-1.5">
                      Months to recover
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={recoveryMonths}
                      onChange={(e) => setRecoveryMonths(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] focus:outline-none focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 transition-all"
                      placeholder="3"
                    />
                    <p className="text-[12px] text-[#8B8B8B] mt-1">
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
                  <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6">
                    <div className="flex items-start gap-3 mb-5">
                      <AlertCircle className="w-5 h-5 text-[#E65100] flex-shrink-0 mt-0.5" />
                      <h3 className="text-[16px] font-semibold text-[#111111]">Recovery Plan</h3>
                    </div>

                    {/* Main Result */}
                    <div className="bg-[#FFF7F2] rounded-xl p-5 mb-5">
                      <p className="text-[13px] text-[#4B4B4B] mb-1">
                        To make up the shortfall, you need
                      </p>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-[24px] font-semibold text-[#E65100] tabular-nums">
                          {formatCurrency(shortfallResult.extraMonthly)}
                        </span>
                        <span className="text-[14px] text-[#4B4B4B]">
                          /month
                        </span>
                      </div>
                      <p className="text-[13px] text-[#4B4B4B]">
                        extra for the next {shortfallResult.recoveryMonths} months
                      </p>
                    </div>

                    {/* Recovery Breakdown */}
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center justify-between p-3 bg-[#F4F4F5] rounded-lg">
                        <span className="text-[13px] text-[#4B4B4B]">Total shortfall</span>
                        <span className="text-[14px] font-semibold text-[#111111] tabular-nums">
                          {formatCurrency(shortfallResult.missedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#F4F4F5] rounded-lg">
                        <span className="text-[13px] text-[#4B4B4B]">Recovery period</span>
                        <span className="text-[14px] font-semibold text-[#111111] tabular-nums">
                          {shortfallResult.recoveryMonths} months
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#FFF7F2] rounded-lg border-l-3 border-[#E65100]">
                        <span className="text-[13px] font-medium text-[#111111]">Extra needed/month</span>
                        <span className="text-[16px] font-semibold text-[#E65100] tabular-nums">
                          {formatCurrency(shortfallResult.extraMonthly)}
                        </span>
                      </div>
                    </div>

                    {/* AI Explanation */}
                    <div className="border-t border-[#F0F0F2] pt-5 mb-5">
                      <h4 className="text-[13px] font-medium text-[#111111] mb-2">
                        Recovery strategy
                      </h4>
                      {shortfallAiLoading ? (
                        <div className="space-y-2 animate-pulse">
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-full" />
                          <div className="h-3.5 bg-[#F4F4F5] rounded w-5/6" />
                        </div>
                      ) : shortfallResult.explanation ? (
                        <p className="text-[13px] text-[#4B4B4B] leading-relaxed">
                          {shortfallResult.explanation}
                        </p>
                      ) : (
                        <p className="text-[13px] text-[#8B8B8B] italic">
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
                  <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#F4F4F5] mb-4">
                      <TrendingUp className="w-6 h-6 text-[#8B8B8B]" />
                    </div>
                    <p className="text-[13px] text-[#4B4B4B]">
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
