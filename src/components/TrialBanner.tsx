"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { Subscription } from "@/lib/database.types";
import { daysLeftInTrial, isInTrial } from "@/lib/feature-gate";

interface TrialBannerProps {
  subscription: Subscription | null;
}

/**
 * Sticky countdown banner shown to users in their 7-day trial.
 * Renders nothing if the user is not in an active trial.
 */
export function TrialBanner({ subscription }: TrialBannerProps) {
  if (!isInTrial(subscription)) return null;

  const daysLeft = daysLeftInTrial(subscription);
  const isUrgent = daysLeft <= 2;

  const message =
    daysLeft === 1
      ? "1 day left in your trial"
      : `${daysLeft} days left in your trial`;

  return (
    <div
      className={[
        "w-full px-md py-sm",
        "flex items-center justify-between gap-md",
        "border-b",
        isUrgent
          ? "bg-amber/10 border-amber/30 text-text-primary"
          : "bg-orange/5 border-orange/20 text-text-primary",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-sm">
        <Icon
          icon={isUrgent ? "lucide:clock-alert" : "lucide:clock"}
          className={isUrgent ? "text-amber" : "text-orange"}
          width={20}
          height={20}
        />
        <span className="text-body font-medium">{message}</span>
        <span className="hidden sm:inline text-body text-text-secondary">
          — Upgrade to Pro for the full experience.
        </span>
      </div>
      <Link
        href="/pricing"
        className={[
          "px-4 py-2 rounded-md text-small font-medium whitespace-nowrap",
          "bg-orange text-white",
          "hover:bg-[#BF4400] transition-colors",
        ].join(" ")}
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
