import { NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { cancelARBSubscription } from "@/lib/authorize-net";
import {
  releaseGhlCancelClaim,
  sendGhlCancelEvent,
  suppressGhlCancel,
} from "@/lib/ghl-events";
import type { GhlCancelReason } from "@/lib/ghl";

/**
 * Cancel a subscriber's recurring billing. Used by the customer
 * (/api/payments/cancel) and by admins on their behalf.
 *
 * Flow 6 from PAYMENTS_PLAN.md:
 *   1. Cancel ARB subscription on Authorize.net
 *   2. Update InsForge:
 *      subscription_status: 'canceled'
 *      anet_subscription_id: null
 *      (Customer Profile is preserved so resubscribe can reuse it)
 *   3. User retains Pro access until current_period_end (feature-gate
 *      handles this — 'canceled' with future current_period_end → 'full')
 */
export async function cancelSubscription(
  userId: string,
  reason: Extract<GhlCancelReason, "user_cancel" | "admin_cancel"> = "user_cancel"
): Promise<NextResponse> {
  const client = getInsForgeAdmin();

  const { data: sub, error: fetchError } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }

  if (!sub.anet_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription to cancel" },
      { status: 400 }
    );
  }

  // If there's a pending switch, the switch ARB should also be cancelled
  const idsToCancel: string[] = [sub.anet_subscription_id];
  if (
    sub.pending_switch_sub_id &&
    sub.pending_switch_sub_id !== sub.anet_subscription_id
  ) {
    idsToCancel.push(sub.pending_switch_sub_id);
  }

  // Claim every id before calling Authorize.net: its cancel webhook fires for
  // these cancels too and must not report them a second time. Only the primary
  // subscription is reported by us; a pending-switch one is just suppressed.
  const claimed: string[] = [];
  for (const id of idsToCancel) {
    if (await suppressGhlCancel(userId, id)) claimed.push(id);
  }

  for (const id of idsToCancel) {
    try {
      await cancelARBSubscription(id);
    } catch (err) {
      // If Authorize.net says it's already canceled, that's fine — keep going
      console.error(`[cancel] failed to cancel ${id}:`, err);
    }
  }

  const now = new Date();
  const { error: updateError } = await client.database
    .from("subscriptions")
    .update({
      subscription_status: "canceled",
      anet_subscription_id: null,
      pending_switch_to: null,
      pending_switch_sub_id: null,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[cancel] DB update failed:", updateError);
    // Not reported, so let the Authorize.net webhook report it if the ARB did cancel.
    await Promise.all(claimed.map((id) => releaseGhlCancelClaim(userId, id)));
    return NextResponse.json(
      { error: "Failed to update subscription record" },
      { status: 500 }
    );
  }

  if (claimed.includes(sub.anet_subscription_id)) {
    await sendGhlCancelEvent(userId, sub.anet_subscription_id, now, reason);
  }

  return NextResponse.json({
    success: true,
    accessUntil: sub.current_period_end,
  });
}
