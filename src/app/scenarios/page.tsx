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
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#FFF8F5] via-[#FFF8F5] to-[#FFE8DC] border-b border-[#E65100]/10">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #E65100 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            {/* Back Button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="group flex items-center gap-2 text-text-secondary hover:text-orange transition-colors mb-8"
            >
              <Icon
                icon="ph:arrow-left-bold"
                className="w-5 h-5 transition-transform group-hover:-translate-x-1"
              />
              <span className="font-body text-sm">Back to Dashboard</span>
            </button>

            {/* Header */}
            <div className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display text-text-primary mb-4 leading-tight">
                What-If Calculator
              </h1>
              <p className="text-lg sm:text-xl text-text-secondary font-body leading-relaxed">
                The hero feature. What-if planning that turns numbers into decisions.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {/* Scenario Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 mb-16">
            {scenarioTypes.map((scenario, index) => {
              const isLocked = trialMode && !TRIAL_FREE_SCENARIOS.has(scenario.id);
              return (
                <LockedFeature key={scenario.id} locked={isLocked} className="rounded-2xl">
                <button
                  onClick={() => router.push(`/scenarios/${scenario.id}`)}
                  className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 hover:border-orange/20 text-left overflow-hidden"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.6s ease-out both'
                  }}
                >
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-orange/0 via-orange/0 to-orange/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Content */}
                  <div className="relative">
                    {/* Icon */}
                    <div
                      className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-6 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3"
                      style={{
                        backgroundColor: `${scenario.color}15`,
                      }}
                    >
                      <Icon
                        icon={scenario.icon}
                        className="w-7 h-7 transition-colors duration-300"
                        style={{ color: scenario.color }}
                      />
                    </div>

                    {/* Text */}
                    <h3 className="text-2xl font-display text-text-primary mb-3 group-hover:text-orange transition-colors duration-300">
                      {scenario.title}
                    </h3>
                    <p className="text-text-secondary font-body leading-relaxed">
                      {scenario.description}
                    </p>

                    {/* Arrow indicator */}
                    <div className="mt-6 flex items-center gap-2 text-orange opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-2">
                      <span className="font-body text-sm font-medium">Explore</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Decorative corner accent */}
                  <div
                    className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500"
                    style={{ backgroundColor: scenario.color }}
                  />
                </button>
                </LockedFeature>
              );
            })}
          </div>

          {/* Saved Scenarios Section */}
          <div className="max-w-4xl">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-3xl font-display text-text-primary">
                Your Saved Scenarios
              </h2>
              {savedScenarios.length > 0 && (
                <span className="text-sm font-body text-text-muted">
                  {savedScenarios.length} {savedScenarios.length === 1 ? 'scenario' : 'scenarios'}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                    <div className="h-5 bg-gray-200 rounded w-1/4 mb-3" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : savedScenarios.length === 0 ? (
              <div className="relative bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center overflow-hidden">
                {/* Subtle pattern background */}
                <div className="absolute inset-0 opacity-[0.02]" style={{
                  backgroundImage: `repeating-linear-gradient(45deg, #E65100 0, #E65100 1px, transparent 0, transparent 50%)`,
                  backgroundSize: '10px 10px'
                }} />

                <div className="relative">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange/10 mb-6 animate-fadeIn">
                    <Icon
                      icon="ph:calculator-duotone"
                      className="w-12 h-12 text-orange/70"
                    />
                  </div>
                  <h3 className="text-xl font-display text-text-primary mb-2">
                    No saved scenarios yet
                  </h3>
                  <p className="text-text-secondary font-body max-w-md mx-auto">
                    Run your first scenario above to start making data-driven decisions for your business.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {savedScenarios.map((scenario, index) => (
                  <button
                    key={scenario.id}
                    onClick={() => router.push(`/scenarios/${scenario.scenario_type}?id=${scenario.id}`)}
                    className="group w-full bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-orange/20 text-left"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: 'fadeInUp 0.4s ease-out both'
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-display text-text-primary group-hover:text-orange transition-colors">
                            {getScenarioTitle(scenario.scenario_type)}
                          </h3>
                          <span className="text-xs font-body text-text-muted">
                            {formatDate(scenario.created_at)}
                          </span>
                        </div>
                        {scenario.result?.summary && (
                          <p className="text-text-secondary font-body text-sm line-clamp-2">
                            {scenario.result.summary}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-5 h-5 text-text-muted group-hover:text-orange group-hover:translate-x-1 transition-all flex-shrink-0"
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

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </AppLayout>
  );
}
