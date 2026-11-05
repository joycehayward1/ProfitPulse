"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { HealthScoreGauge } from "@/components/ui/HealthScoreGauge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TrafficLightDot } from "@/components/ui/TrafficLightDot";
import type { HealthStatus } from "@/components/ui/TrafficLightDot";
import { calculateHealthScore, getHealthStatus } from "@/lib/healthScore";
import { SAMPLE_BUSINESS_NAME, SAMPLE_DASHBOARD as S } from "@/lib/sample-dashboard";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function ExampleTag() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-insight-subtle text-insight">
      <Icon icon="ph:flask-bold" className="w-3 h-3" aria-hidden="true" />
      Example
    </span>
  );
}

function SampleMetric({
  label,
  value,
  statusText,
  status,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  statusText: string;
  status: HealthStatus;
  icon: string;
  iconColor: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
      <div className="flex items-center justify-between mb-sm">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${iconColor}15, ${iconColor}05)` }}
        >
          <Icon icon={icon} className="w-5 h-5" style={{ color: iconColor }} aria-hidden="true" />
        </div>
        <TrafficLightDot status={status} />
      </div>
      <h3 className="text-body-sm font-medium text-text-secondary mb-1">{label}</h3>
      <p className="font-display text-metric-sm text-text-primary tabular-nums leading-tight">{value}</p>
      <p className="text-label text-text-muted mt-1">{statusText}</p>
    </div>
  );
}

interface SampleDashboardPreviewProps {
  /** Shown when the tour was paused, so it can be picked up again. */
  onResumeTour?: () => void;
  /** Hide the example for good (same as finishing the tour). */
  onDismissExample?: () => void;
}

/**
 * Static preview of a populated dashboard for accounts with no numbers yet.
 * Everything here is example data and is labelled as such.
 */
export function SampleDashboardPreview({ onResumeTour, onDismissExample }: SampleDashboardPreviewProps) {
  const score = calculateHealthScore({
    cashOnHand: S.cashOnHand,
    monthlyRevenue: S.monthlyRevenue,
    monthlyExpenses: S.monthlyExpenses,
    accountsReceivable: S.accountsReceivable,
  });
  const runwayMonths = Math.floor(S.cashOnHand / S.monthlyExpenses);
  const maxTrend = Math.max(...S.incomeTrend.map((m) => Math.max(m.income, m.expenses)));

  return (
    <section aria-labelledby="sample-dashboard-heading" className="space-y-md">
      <div
        data-tour="sample-banner"
        className="rounded-xl border border-insight/30 bg-insight-subtle p-md flex flex-col md:flex-row md:items-center gap-md"
      >
        <div className="flex items-start gap-sm flex-1">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-insight/10 flex items-center justify-center">
            <Icon icon="ph:eye-bold" className="w-5 h-5 text-insight" aria-hidden="true" />
          </div>
          <div>
            <h2 id="sample-dashboard-heading" className="text-body font-semibold text-text-primary">
              Example dashboard: not your data
            </h2>
            <p className="text-body-sm text-text-secondary">
              These numbers are for a made-up business ({SAMPLE_BUSINESS_NAME}) to show you how MyProfitPulse works.
              Nothing here is saved to your account.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-sm md:justify-end">
          {onResumeTour && (
            <button
              type="button"
              onClick={onResumeTour}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium text-insight bg-white border border-insight/30 hover:bg-insight/5 transition-colors"
            >
              <Icon icon="ph:play-bold" className="w-4 h-4" aria-hidden="true" />
              Resume tour
            </button>
          )}
          {onDismissExample && (
            <button
              type="button"
              onClick={onDismissExample}
              className="px-3 py-2 rounded-lg text-body-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              Hide example
            </button>
          )}
        </div>
      </div>

      <div
        data-tour="sample-health-score"
        className="bg-surface rounded-xl border border-border-light shadow-card overflow-hidden"
      >
        <div className="h-0.5 bg-orange" />
        <div className="p-lg">
          <div className="mb-md flex items-center gap-2">
            <span className="text-label uppercase tracking-wider text-orange font-semibold">
              Business Health
            </span>
            <ExampleTag />
          </div>
          <div className="grid md:grid-cols-2 gap-xl items-center">
            <div className="flex flex-col items-center space-y-md">
              <HealthScoreGauge score={score.totalScore} size="lg" />
              <StatusBadge status={getHealthStatus(score.totalScore)} className="text-[14px] px-lg py-sm" />
            </div>
            <div className="space-y-xs">
              {[score.cashRunway.description, score.profitMargin.description, score.receivablesHealth.description].map(
                (line) => (
                  <p key={line} className="flex items-start gap-sm text-body text-text-secondary">
                    <span className="text-orange mt-1 flex-shrink-0" aria-hidden="true">•</span>
                    <span>{line}</span>
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <div data-tour="sample-metrics" className="grid gap-md md:grid-cols-3">
        <SampleMetric
          label="Profit (example)"
          value={formatCurrency(S.netProfit)}
          statusText="On Track"
          status="healthy"
          icon="ph:chart-line-bold"
          iconColor="#E65100"
        />
        <SampleMetric
          label="Cash Flow (example)"
          value={formatCurrency(S.netCashFlow)}
          statusText="Healthy"
          status="healthy"
          icon="ph:wallet-bold"
          iconColor="#43A047"
        />
        <SampleMetric
          label="Runway (example)"
          value={`${runwayMonths} months`}
          statusText="Healthy"
          status="healthy"
          icon="ph:timer-bold"
          iconColor="#7B1FA2"
        />
      </div>

      <div className="grid gap-md md:grid-cols-2">
        <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
          <div className="flex items-center gap-2 mb-sm">
            <h3 className="text-heading font-semibold text-text-primary">P&L Snapshot</h3>
            <ExampleTag />
          </div>
          <table className="w-full">
            <caption className="sr-only">Example profit and loss figures</caption>
            <tbody>
              {S.pl.map((row) => (
                <tr key={row.label} className="border-b border-border-light last:border-b-0">
                  <th scope="row" className="py-2 text-left text-body font-normal text-text-secondary">
                    {row.label}
                  </th>
                  <td className="py-2 text-right text-body font-semibold tabular-nums text-text-primary">
                    {formatCurrency(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-surface rounded-xl p-lg border border-border-light shadow-card">
          <div className="flex items-center gap-2 mb-sm">
            <h3 className="text-heading font-semibold text-text-primary">Income Trend</h3>
            <ExampleTag />
          </div>
          <div className="flex items-end gap-2 h-32" role="img" aria-label="Example income rising over six months">
            {S.incomeTrend.map((m) => (
              <div key={m.month} className="flex-1 flex items-end gap-0.5 h-full">
                <div className="flex-1 rounded-t bg-[#E8541A]" style={{ height: `${(m.income / maxTrend) * 100}%` }} />
                <div className="flex-1 rounded-t bg-[#5B21B6]" style={{ height: `${(m.expenses / maxTrend) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-md mt-sm text-label text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#E8541A]" aria-hidden="true" /> Income
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#5B21B6]" aria-hidden="true" /> Expenses
            </span>
          </div>
        </div>
      </div>

      <div
        data-tour="sample-cta"
        className="bg-surface rounded-xl p-lg border border-border-light shadow-card flex flex-col md:flex-row md:items-center gap-md"
      >
        <div className="flex-1">
          <h3 className="text-heading font-semibold text-text-primary">Ready to see your own numbers?</h3>
          <p className="text-body-sm text-text-secondary">
            Answer a few simple questions and we&apos;ll show you exactly where you stand. Takes about 2 minutes.
          </p>
        </div>
        <Link
          href="/assessment"
          className="inline-flex items-center justify-center gap-2 px-lg py-md rounded-lg bg-orange text-white text-[14px] font-medium hover:bg-[#BF4400] transition-colors whitespace-nowrap"
        >
          Complete Your Assessment
          <Icon icon="lucide:arrow-right" className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
