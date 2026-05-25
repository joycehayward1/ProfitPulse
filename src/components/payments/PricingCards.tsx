"use client";

import { Icon } from "@iconify/react";

export type BillingInterval = "monthly" | "annual";

export interface PricingPlan {
  id: BillingInterval;
  name: string;
  priceLabel: string;
  priceSub: string;
  billedNote: string;
  highlight?: boolean;
  savingsLabel?: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "monthly",
    name: "Pro Monthly",
    priceLabel: "$59.99",
    priceSub: "/month",
    billedNote: "Billed monthly. Cancel anytime.",
  },
  {
    id: "annual",
    name: "Pro Annual",
    priceLabel: "$49.99",
    priceSub: "/month",
    billedNote: "Billed $599.88/year upfront.",
    highlight: true,
    savingsLabel: "Save $120",
  },
];

const FEATURES = [
  "All financial metrics & graphs",
  "All 4 scenario calculators",
  "CSV / spreadsheet upload",
  "Weekly scorecard emails",
  "AI insights & proactive alerts",
  "Priority email support",
];

interface PricingCardsProps {
  selected: BillingInterval | null;
  onSelect: (interval: BillingInterval) => void;
}

/**
 * Two-card plan picker: Monthly vs Annual.
 * Stateless — parent controls `selected` and `onSelect`.
 */
export function PricingCards({ selected, onSelect }: PricingCardsProps) {
  return (
    <div className="grid gap-md md:grid-cols-2 max-w-3xl mx-auto">
      {PRICING_PLANS.map((plan) => {
        const isSelected = selected === plan.id;
        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={[
              "relative text-left rounded-xl p-lg transition-all duration-200",
              "border-2 bg-surface",
              isSelected
                ? "border-orange shadow-[0_8px_24px_rgba(230,81,0,0.15)]"
                : "border-[#E5E0DA] hover:border-orange/40 hover:shadow-md",
            ].join(" ")}
            aria-pressed={isSelected}
          >
            {plan.savingsLabel && (
              <div className="absolute -top-3 right-md">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success text-white text-small font-semibold shadow-sm">
                  <Icon icon="lucide:sparkles" width={14} height={14} />
                  {plan.savingsLabel}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between mb-sm">
              <h3 className="font-display text-h3 text-text-primary">
                {plan.name}
              </h3>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-orange flex items-center justify-center flex-shrink-0">
                  <Icon icon="lucide:check" className="text-white" width={16} height={16} />
                </div>
              )}
            </div>

            <div className="mb-md">
              <span className="font-display text-[42px] leading-none text-text-primary tracking-tight">
                {plan.priceLabel}
              </span>
              <span className="text-body text-text-secondary ml-1">
                {plan.priceSub}
              </span>
            </div>

            <p className="text-small text-text-muted mb-md">{plan.billedNote}</p>

            <ul className="space-y-xs">
              {FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-small text-text-secondary"
                >
                  <Icon
                    icon="lucide:check"
                    className="text-success mt-[2px] flex-shrink-0"
                    width={14}
                    height={14}
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
