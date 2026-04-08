"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import type { Subscription } from "@/lib/database.types";

interface DunningBannerProps {
  subscription: Subscription | null;
}

function daysLeftInGrace(lastPaymentDate: string | null): number {
  if (!lastPaymentDate) return 0;
  const failedAt = new Date(lastPaymentDate).getTime();
  const elapsed = (Date.now() - failedAt) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(3 - elapsed));
}

/**
 * Red dunning banner shown when a renewal charge failed and the user is in
 * their 3-day grace period. Links to /settings#billing so they can update
 * their card.
 *
 * Renders nothing unless subscription_status === 'past_due'.
 */
export function DunningBanner({ subscription }: DunningBannerProps) {
  if (subscription?.subscription_status !== "past_due") return null;

  const daysLeft = daysLeftInGrace(subscription.last_payment_date);
  const graceMsg =
    daysLeft > 0
      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left before access is locked.`
      : "Grace period expired.";

  return (
    <div
      className="w-full px-md py-sm flex items-center justify-between gap-md border-b bg-error/10 border-error/30"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-sm">
        <Icon
          icon="lucide:alert-triangle"
          className="text-error flex-shrink-0"
          width={20}
          height={20}
        />
        <div className="min-w-0">
          <span className="text-body font-medium text-text-primary">
            Your payment failed — update your billing info.
          </span>
          <span className="hidden sm:inline text-body text-text-secondary ml-1">
            {graceMsg}
          </span>
        </div>
      </div>
      <Link
        href="/billing"
        className="px-4 py-2 rounded-md text-small font-medium whitespace-nowrap bg-error text-white hover:bg-[#B91C1C] transition-colors"
      >
        Update card
      </Link>
    </div>
  );
}
