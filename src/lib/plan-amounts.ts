import type { BillingInterval } from "@/components/payments/PricingCards";

const MONTHLY_AMOUNT = 59.99;
const ANNUAL_AMOUNT = 599.88;

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

export function getPlanAmount(billingInterval: BillingInterval): number {
  const testAmount = getLiveTestAmount();
  if (testAmount !== null) return testAmount;
  return billingInterval === "monthly" ? MONTHLY_AMOUNT : ANNUAL_AMOUNT;
}

export function formatPlanAmount(billingInterval: BillingInterval): string {
  return `$${getPlanAmount(billingInterval).toFixed(2)}`;
}
