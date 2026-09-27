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
/**
 * End of paid access including any comped days (goodwill credit granted via
 * the admin panel). With comp_days = 0 this is just current_period_end.
 */
function effectivePeriodEnd(subscription: Subscription): Date | null {
  if (!subscription.current_period_end) return null;
  const end = new Date(subscription.current_period_end);
  if (subscription.comp_days) {
    end.setDate(end.getDate() + subscription.comp_days);
  }
  return end;
}

export function getUserAccessLevel(subscription: Subscription | null): AccessLevel {
  if (!subscription) return "locked";

  const now = new Date();
  const periodEnd = effectivePeriodEnd(subscription);

  // Active paid subscriber
  if (
    subscription.subscription_status === "active" &&
    subscription.plan === "pro" &&
    periodEnd &&
    periodEnd > now
  ) {
    return "full";
  }

  // Canceled but still in paid (or comped) period
  if (
    subscription.subscription_status === "canceled" &&
    periodEnd &&
    periodEnd > now
  ) {
    return "full";
  }

  // Comped users keep access through their comp window even if the ARB
  // ended some other way (terminated after card failures, expired).
  if (subscription.comp_days > 0 && periodEnd && periodEnd > now) {
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

export type AccessReason =
  | "paid"
  | "lifetime"
  | "granted"
  | "canceled_in_period"
  | "comped"
  | "grace"
  | "trial"
  | "trial_expired"
  | "canceled"
  | "past_due"
  | "lapsed"
  | "grant_ended"
  | "none";

export interface AccessSummary {
  level: AccessLevel;
  reason: AccessReason;
  /** When access ends (ISO), or null when locked. */
  until: string | null;
}

/** Period ends more than 50 years out are admin-granted lifetime access. */
function isLifetimeEnd(end: Date): boolean {
  return end.getFullYear() - new Date().getFullYear() > 50;
}

/**
 * Why a user has (or lacks) access, and until when — for the admin panel.
 * Follows the same branches, in the same order, as getUserAccessLevel.
 */
export function getAccessSummary(subscription: Subscription | null): AccessSummary {
  if (!subscription) return { level: "locked", reason: "none", until: null };

  const now = new Date();
  const periodEnd = effectivePeriodEnd(subscription);
  const status = subscription.subscription_status;

  // No recurring billing behind an active Pro row = access an admin granted
  // (or a comped signup); a live ARB means they're paying.
  const billed = Boolean(subscription.anet_subscription_id);

  if (status === "active" && subscription.plan === "pro" && periodEnd && periodEnd > now) {
    return {
      level: "full",
      reason: isLifetimeEnd(periodEnd) ? "lifetime" : billed ? "paid" : "granted",
      until: periodEnd.toISOString(),
    };
  }

  if (status === "canceled" && periodEnd && periodEnd > now) {
    return { level: "full", reason: "canceled_in_period", until: periodEnd.toISOString() };
  }

  if (subscription.comp_days > 0 && periodEnd && periodEnd > now) {
    return { level: "full", reason: "comped", until: periodEnd.toISOString() };
  }

  if (
    status === "past_due" &&
    subscription.last_payment_date &&
    daysSince(subscription.last_payment_date) <= 3
  ) {
    const graceEnd = new Date(subscription.last_payment_date);
    graceEnd.setDate(graceEnd.getDate() + 4);
    return { level: "full", reason: "grace", until: graceEnd.toISOString() };
  }

  if (status === "trial" && subscription.trial_end_date && new Date(subscription.trial_end_date) > now) {
    return { level: "trial", reason: "trial", until: subscription.trial_end_date };
  }

  const lockedReason: AccessReason =
    status === "trial"
      ? "trial_expired"
      : status === "canceled"
      ? "canceled"
      : status === "past_due"
      ? "past_due"
      : status === "active" && periodEnd && billed
      ? "lapsed" // marked active, but the paid period ended with no renewal recorded
      : status === "active" && periodEnd
      ? "grant_ended" // free access an admin granted has run out
      : "none";
  return { level: "locked", reason: lockedReason, until: null };
}
