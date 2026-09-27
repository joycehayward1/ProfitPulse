import { getInsForgeAdmin } from "@/lib/insforge";
import {
  chargeCustomerProfile,
  computePeriodEnd,
  getARBSubscription,
  getPlanAmount,
} from "@/lib/authorize-net";
import type { BillingInterval } from "@/components/payments/PricingCards";
import type { PricingPromo } from "@/lib/plan-amounts";
import type { Subscription } from "@/lib/database.types";

/**
 * A declined renewal the customer still owes. Authorize.net never retries a
 * declined recurring charge on an active subscription, so the customer has to
 * try their card again or add a new one — and we charge the missed period then.
 */
export function owesMissedRenewal(sub: Subscription | null): boolean {
  return Boolean(
    sub &&
      sub.anet_subscription_id &&
      sub.anet_customer_profile_id &&
      sub.last_payment_status === "failed" &&
      (sub.subscription_status === "past_due" || sub.subscription_status === "active")
  );
}

export type SettleResult =
  | { status: "paid"; amount: number; transId: string; periodEnd: string }
  | { status: "declined"; amount: number; reason: string }
  /** Authorize.net suspended the ARB; updating the card makes it retry the charge itself. */
  | { status: "left_to_authorize_net" }
  | { status: "nothing_owed" };

/**
 * Charge the missed renewal to `paymentProfileId` and, on success, restore
 * access through the next date the ARB will bill (so the schedule stays on
 * the customer's original billing day).
 */
export async function settleMissedRenewal(
  sub: Subscription,
  paymentProfileId: string,
  email?: string | null
): Promise<SettleResult> {
  if (!owesMissedRenewal(sub)) return { status: "nothing_owed" };

  // A suspended ARB is retried by Authorize.net when its payment info is
  // updated. Charging here too would bill the customer twice.
  try {
    const live = await getARBSubscription(sub.anet_subscription_id as string);
    if (live.status.toLowerCase() === "suspended") return { status: "left_to_authorize_net" };
  } catch (err) {
    // If we can't confirm the ARB state, don't risk a double charge.
    console.error("[missed-renewal] ARB lookup failed; not charging", err);
    throw new Error("We couldn't check your subscription right now. Please try again in a few minutes.");
  }

  const interval = (sub.billing_interval === "annual" ? "annual" : "monthly") as BillingInterval;
  const promo = (sub.pricing_promo === "launch" ? "launch" : "standard") as PricingPromo;
  const amount = Number(sub.last_payment_amount) || getPlanAmount(interval, promo);

  let transId: string;
  try {
    const txn = await chargeCustomerProfile({
      amount,
      customerProfileId: sub.anet_customer_profile_id as string,
      customerPaymentProfileId: paymentProfileId,
      description: `MyProfitPulse Pro ${interval} — missed renewal`,
      email: email ?? undefined,
    });
    transId = txn.transId;
  } catch (err) {
    const reason = err instanceof Error ? err.message.replace(/^\[[^\]]+\]\s*/, "") : "Declined";
    return { status: "declined", amount, reason };
  }

  // The missed period started at the old period end; it runs until the next
  // ARB charge. If several periods were missed, only the latest is collected,
  // so never set an end in the past.
  const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  let periodEnd = computePeriodEnd(interval, base);
  if (periodEnd <= new Date()) periodEnd = computePeriodEnd(interval, new Date());
  const now = new Date().toISOString();

  const client = getInsForgeAdmin();
  const { error: updateError } = await client.database
    .from("subscriptions")
    .update({
      subscription_status: "active",
      anet_payment_profile_id: paymentProfileId,
      billing_cycle_start_date: now,
      current_period_end: periodEnd.toISOString(),
      next_billing_date: periodEnd.toISOString(),
      last_payment_date: now,
      last_payment_amount: amount,
      last_payment_status: "success",
      updated_at: now,
    })
    .eq("user_id", sub.user_id);
  if (updateError) {
    // The customer was charged — log loudly; the nightly reconcile and the
    // payment record below let an admin repair the row.
    console.error("[missed-renewal] CHARGED but subscription update failed", {
      userId: sub.user_id,
      transId,
      updateError,
    });
  }

  await client.database.from("payment_records").insert([
    {
      user_id: sub.user_id,
      anet_transaction_id: transId,
      type: "renewal",
      amount,
      status: "success",
      billing_interval: interval,
      description: `MyProfitPulse Pro ${interval} — missed renewal paid`,
    },
  ]);

  return { status: "paid", amount, transId, periodEnd: periodEnd.toISOString() };
}
