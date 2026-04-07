"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

interface PaywallScreenProps {
  /** Optional headline override (e.g. for past_due vs trial-expired contexts). */
  heading?: string;
  /** Optional subheading override. */
  subheading?: string;
}

/**
 * Full-screen paywall shown when a user's trial has expired (or their
 * subscription is otherwise locked). The only path forward is to subscribe.
 */
export function PaywallScreen({
  heading = "Your trial has ended",
  subheading = "Subscribe to Pro to keep using ProfitPulse and unlock the full dashboard.",
}: PaywallScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-md py-xl">
      <div className="max-w-lg w-full bg-surface border border-[#E5E0DA] rounded-lg shadow-lg p-xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center mb-md">
          <Icon icon="lucide:lock" className="text-orange" width={32} height={32} />
        </div>

        <h1 className="font-display text-h2 text-text-primary mb-sm">{heading}</h1>
        <p className="text-body text-text-secondary mb-lg">{subheading}</p>

        <div className="space-y-sm text-left bg-background rounded-md p-md mb-lg">
          <p className="text-small font-medium text-text-primary mb-xs">
            Pro includes:
          </p>
          <ul className="space-y-xs text-small text-text-secondary">
            {[
              "All financial metrics & graphs",
              "All 4 scenario calculators",
              "CSV / spreadsheet upload",
              "Weekly scorecard emails",
              "AI insights & proactive alerts",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Icon
                  icon="lucide:check"
                  className="text-success mt-[2px] flex-shrink-0"
                  width={16}
                  height={16}
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/pricing"
          className={[
            "inline-block w-full px-8 py-4 rounded-md",
            "bg-orange text-white text-body font-medium",
            "hover:bg-[#BF4400] active:bg-[#A33B00] transition-colors",
            "shadow-[0_2px_8px_rgba(230,81,0,0.25)]",
          ].join(" ")}
        >
          Subscribe to Pro
        </Link>
      </div>
    </div>
  );
}
