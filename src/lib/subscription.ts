/**
 * Stub subscription utility.
 * Returns "growth" as default tier until Stripe is integrated.
 */

export type SubscriptionTier = "starter" | "growth" | "scale";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getUserTier(userId: string): SubscriptionTier {
  // TODO: Replace with real Stripe lookup after integration
  return "growth";
}
