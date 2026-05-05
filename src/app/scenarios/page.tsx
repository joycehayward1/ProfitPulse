"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { isInTrial } from "@/lib/feature-gate";
import { LockedFeature } from "@/components/LockedFeature";

// Calculators available during trial — others are locked behind Pro
const TRIAL_FREE_SCENARIOS = new Set(["break-even", "goal-planning"]);

interface SavedScenario {
  id: string;
  scenario_type: string;
  created_at: string;
  result: {
    summary?: string;
  };
}

const scenarioTypes = [
  {
    id: "break-even",
    title: "Break-Even",
    description: "Calculate the exact level you need to hit",
    icon: "ph:equals-bold",
    color: "#E65100",
  },
  {
    id: "goal-planning",
    title: "Goal Planning",
    description: "Plan your revenue targets and monthly goals",
    icon: "ph:flag-banner-bold",
    color: "#7B1FA2",
  },
  {
    id: "hiring",
    title: "Can I Hire?",
    description: "See if you can afford to hire new help",
    icon: "ph:user-plus-bold",
    color: "#E65100",
  },
  {
    id: "runway",
    title: "Cash Runway",
    description: "Check how long your cash will last",
    icon: "ph:timer-bold",
    color: "#7B1FA2",
  },
];

export default function ScenariosPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const { subscription } = useAuth();
  const trialMode = isInTrial(subscription);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSavedScenarios() {
      if (!user) return;

      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();

        const { data, error } = await client.database
          .from('scenarios')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        setSavedScenarios(data || []);
      } catch (error) {
        console.error('Error loading scenarios:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSavedScenarios();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScenarioTitle = (type: string) => {
    return scenarioTypes.find(s => s.id === type)?.title || type;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F8F8F8]">
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-[#8B8B8B] hover:text-[#111111] transition-colors mb-6"
          >
            <Icon icon="ph:arrow-left-bold" className="w-4 h-4" />
            <span className="text-[13px]">Back to Dashboard</span>
          </button>

          <h1 className="text-[28px] font-bold text-[#111111] mb-1">
            What-If Calculator
          </h1>
          <p className="text-[15px] text-[#4B4B4B]">
            The hero feature. What-if planning that turns numbers into decisions.
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Scenario Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scenarioTypes.map((scenario) => {
              const isLocked = trialMode && !TRIAL_FREE_SCENARIOS.has(scenario.id);
              return (
                <LockedFeature key={scenario.id} locked={isLocked} visibleWhenLocked className="rounded-xl">
                  <button
                    onClick={() => router.push(`/scenarios/${scenario.id}`)}
                    className="group w-full bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#F0F0F2] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#E4E4E7] transition-all text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg"
                          style={{ backgroundColor: `${scenario.color}12` }}
                        >
                          <Icon
                            icon={scenario.icon}
                            className="w-5 h-5"
                            style={{ color: scenario.color }}
                          />
                        </div>

                        {/* Text */}
                        <div>
                          <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                            {scenario.title}
                          </h3>
                          <p className="text-[13px] text-[#4B4B4B]">
                            {scenario.description}
                          </p>
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      <svg
                        className="w-4 h-4 text-[#8B8B8B] group-hover:text-[#111111] transition-colors flex-shrink-0 mt-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                </LockedFeature>
              );
            })}
          </div>

          {/* Saved Scenarios Section */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[20px] font-semibold text-[#111111]">
                Your Saved Scenarios
              </h2>
              {savedScenarios.length > 0 && (
                <span className="text-[13px] text-[#8B8B8B]">
                  {savedScenarios.length} {savedScenarios.length === 1 ? 'scenario' : 'scenarios'}
                </span>
              )}
            </div>

            {loading ? (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-[#F0F0F2]">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-[#F4F4F5] rounded w-1/4 mb-2" />
                    <div className="h-3 bg-[#F4F4F5] rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : savedScenarios.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#F4F4F5] mb-4">
                  <Icon
                    icon="ph:calculator-duotone"
                    className="w-6 h-6 text-[#8B8B8B]"
                  />
                </div>
                <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                  No saved scenarios yet
                </h3>
                <p className="text-[13px] text-[#4B4B4B] max-w-sm mx-auto">
                  Run your first scenario above to start making data-driven decisions for your business.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-[#F0F0F2]">
                {savedScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => router.push(`/scenarios/${scenario.scenario_type}?id=${scenario.id}`)}
                    className="group w-full p-4 hover:bg-[#F8F8F8] transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-[14px] font-semibold text-[#111111]">
                            {getScenarioTitle(scenario.scenario_type)}
                          </h3>
                          <span className="text-[12px] text-[#8B8B8B]">
                            {formatDate(scenario.created_at)}
                          </span>
                        </div>
                        {scenario.result?.summary && (
                          <p className="text-[13px] text-[#4B4B4B] line-clamp-2">
                            {scenario.result.summary}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-4 h-4 text-[#8B8B8B] group-hover:text-[#111111] transition-colors flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
