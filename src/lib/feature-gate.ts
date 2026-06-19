/**
 * Feature gating logic for MyProfitPulse subscriptions.
 * Returns the user's current access level based on their subscription state.
 *
 * Mirrors `getUserAccessLevel` from PAYMENTS_PLAN.md.
 */

import type { Subscription } from "./database.types";

export type AccessLevel = "full" | "trial" | "locked";

/** Number of days between two dates (positive if `since` is in the past). */
function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Compute the user's current access level.
 *
 * - `full`: active paid subscriber, canceled-but-still-in-period, or past_due
 *   within a 3-day grace window.
 * - `trial`: in active trial (subscriptionStatus === 'trial' and trialEndDate
 *   is still in the future).
 * - `locked`: everything else (expired trial, terminated, etc.).
 */
export function getUserAccessLevel(subscription: Subscription | null): AccessLevel {
  if (!subscription) return "locked";

  const now = new Date();

  // Active paid subscriber
  if (
    subscription.subscription_status === "active" &&
    subscription.plan === "pro" &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) > now
  ) {
    return "full";
  }

  // Canceled but still in paid period
  if (
    subscription.subscription_status === "canceled" &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) > now
  ) {
    return "full";
  }

  // Past due but within 3-day grace period
  if (
    subscription.subscription_status === "past_due" &&
    subscription.last_payment_date &&
    daysSince(subscription.last_payment_date) <= 3
  ) {
    return "full";
  }

  // Active trial
  if (
    subscription.subscription_status === "trial" &&
    subscription.trial_end_date &&
    new Date(subscription.trial_end_date) > now
  ) {
    return "trial";
  }

  // Everything else: expired, terminated, trial ended, etc.
  return "locked";
}

/**
 * Days remaining in the user's trial. Returns 0 if no trial or trial ended.
 * Rounds up so that "less than 1 day left" still shows as "1 day".
 */
export function daysLeftInTrial(subscription: Subscription | null): number {
  if (!subscription?.trial_end_date) return 0;
  const ms = new Date(subscription.trial_end_date).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** True if the user is currently in an active trial. */
export function isInTrial(subscription: Subscription | null): boolean {
  return getUserAccessLevel(subscription) === "trial";
}

/** True if the user has full Pro access. */
export function hasFullAccess(subscription: Subscription | null): boolean {
  return getUserAccessLevel(subscription) === "full";
}

/** True if the user is locked out (no trial, no active sub). */
export function isLocked(subscription: Subscription | null): boolean {
  return getUserAccessLevel(subscription) === "locked";
}
