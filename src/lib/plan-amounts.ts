import type { BillingInterval } from "@/components/payments/PricingCards";

const MONTHLY_AMOUNT = 59.99;
const ANNUAL_AMOUNT = 599.88;

/**
 * "launch" — 20% off monthly / 30% off annual, locked in on every renewal.
 * Sold only via /launch (not linked from the landing page). Subscribers
 * keep the rate via `pricing_promo` on their subscriptions row.
 */
export type PricingPromo = "standard" | "launch";

const LAUNCH_MONTHLY_DISCOUNT = 0.2;
const LAUNCH_ANNUAL_DISCOUNT = 0.3;

/**
 * Temporary live validation pricing. Set on Vercel, then remove after go-live test.
 * Server charges use ANET_LIVE_TEST_AMOUNT; UI uses NEXT_PUBLIC_ANET_LIVE_TEST_AMOUNT.
 */
export function getLiveTestAmount(): number | null {
  const raw =
    process.env.ANET_LIVE_TEST_AMOUNT ??
    process.env.NEXT_PUBLIC_ANET_LIVE_TEST_AMOUNT;
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isLiveTestPricing(): boolean {
  return getLiveTestAmount() !== null;
}

export function getPlanAmount(
  billingInterval: BillingInterval,
  promo: PricingPromo = "standard"
): number {
  const testAmount = getLiveTestAmount();
  if (testAmount !== null) return testAmount;

  const base = billingInterval === "monthly" ? MONTHLY_AMOUNT : ANNUAL_AMOUNT;
  if (promo === "launch") {
    const discount =
      billingInterval === "monthly" ? LAUNCH_MONTHLY_DISCOUNT : LAUNCH_ANNUAL_DISCOUNT;
    return Math.round(base * (1 - discount) * 100) / 100;
  }
  return base;
}

/** Per-month display rate (annual shown as monthly equivalent). */
export function getDisplayMonthlyRate(
  billingInterval: BillingInterval,
  promo: PricingPromo = "standard"
): number {
  if (billingInterval === "annual") {
    return Math.round((getPlanAmount("annual", promo) / 12) * 100) / 100;
  }
  return getPlanAmount("monthly", promo);
}

export function formatPlanAmount(
  billingInterval: BillingInterval,
  promo: PricingPromo = "standard"
): string {
  return `$${getPlanAmount(billingInterval, promo).toFixed(2)}`;
}

export function formatDisplayMonthlyRate(
  billingInterval: BillingInterval,
  promo: PricingPromo = "standard"
): string {
  const rate = getDisplayMonthlyRate(billingInterval, promo);
  return `$${Number.isInteger(rate) ? rate : rate.toFixed(2)}`;
}
