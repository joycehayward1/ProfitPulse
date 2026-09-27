"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  getFocusAreas,
  getRealityChecks,
  type FinancialContext,
  type SelfAssessment,
} from "@/lib/self-assessment";

function habitsLabel(score: number): string {
  if (score >= 75) return "Strong habits";
  if (score >= 50) return "Solid foundation";
  if (score >= 25) return "Room to grow";
  return "Just getting started";
}

interface FocusAreasCardProps {
  selfAssessment: SelfAssessment;
  context: FinancialContext;
}

export function FocusAreasCard({ selfAssessment, context }: FocusAreasCardProps) {
  const focusAreas = getFocusAreas(selfAssessment, context);
  const realityChecks = getRealityChecks(selfAssessment.ratings, context);

  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md mb-md">
        <div>
          <span className="text-label uppercase tracking-wider text-orange font-semibold">
            Your Focus Areas
          </span>
          <p className="text-body-sm text-text-muted mt-1">
            Based on what you told us in your check-in
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-body-sm text-text-muted">Financial Habits</p>
          <p className="font-display text-metric-sm text-text-primary leading-tight tabular-nums">
            {selfAssessment.habits_score}
            <span className="text-body-sm text-text-muted">/100</span>
          </p>
          <p className="text-body-sm text-text-secondary">{habitsLabel(selfAssessment.habits_score)}</p>
        </div>
      </div>

      {selfAssessment.vision && (
        <p className="text-body text-text-secondary italic border-l-2 border-orange pl-md mb-md">
          &ldquo;{selfAssessment.vision}&rdquo;
        </p>
      )}

      <div className="grid gap-md md:grid-cols-3">
        {focusAreas.map((area) => (
          <div
            key={area.painPoint}
            className="flex flex-col rounded-lg border border-border-light p-md"
          >
            <h3 className="text-body font-semibold text-text-primary mb-1">{area.title}</h3>
            <p className="text-body-sm text-text-secondary flex-1">{area.detail}</p>
            <Link
              href={area.href}
              className="mt-sm inline-flex items-center gap-1 text-body-sm font-medium text-orange hover:underline"
            >
              {area.actionLabel}
              <Icon icon="ph:arrow-right-bold" className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
      </div>

      {realityChecks.length > 0 && (
        <div className="mt-md pt-md border-t border-border-light space-y-sm">
          {realityChecks.map((check) => (
            <p key={check.message} className="flex items-start gap-sm text-body-sm text-text-secondary">
              <Icon
                icon={check.tone === "positive" ? "ph:check-circle-fill" : "ph:warning-circle-fill"}
                className={`w-5 h-5 flex-shrink-0 ${check.tone === "positive" ? "text-success" : "text-warning"}`}
              />
              <span>{check.message}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
