import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getARBSubscription, computePeriodEnd } from "@/lib/authorize-net";
import type { BillingInterval } from "@/components/payments/PricingCards";

/**
 * GET /api/cron/arb-reconcile
 *
 * Daily reconciliation job. For every active subscription in InsForge,
 * calls ARBGetSubscriptionRequest on Authorize.net to get the latest state:
 *
 * 1. If the ARB status is 'suspended' → mark past_due
 * 2. If the ARB status is 'terminated' or 'canceled' → mark the same
 * 3. If there's a successful transaction NEWER than our billing_cycle_start_date
 *    → a renewal happened we didn't capture via webhook. Update billing dates
 *    and insert a payment_records row.
 *
 * This is belt-and-suspenders protection against missed webhooks. It runs
 * once a day (configured in vercel.json).
 *
 * Secured by the CRON_SECRET env var — Vercel cron infrastructure sends the
 * header automatically. Manual invocations must include
 * `Authorization: Bearer <CRON_SECRET>`.
 */

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Find every subscription that has an ARB ID and isn't already terminated
  const { data: subs, error: fetchError } = await client.database
    .from("subscriptions")
    .select("*")
    .not("anet_subscription_id", "is", null)
    .in("subscription_status", ["active", "past_due", "canceled"]);

  if (fetchError) {
    console.error("[arb-reconcile] failed to fetch subscriptions:", fetchError);
    return NextResponse.json({ error: "db fetch failed" }, { status: 500 });
  }

  const results: Array<{
    userId: string;
    subscriptionId: string;
    action: string;
    detail?: string;
  }> = [];

  for (const sub of subs ?? []) {
    const subscriptionId = sub.anet_subscription_id as string;
    const billingInterval = sub.billing_interval as BillingInterval;

    try {
      const anet = await getARBSubscription(subscriptionId);

      // ─── Status mapping ──────────────────────────────────────────────────
      const anetStatus = anet.status.toLowerCase();
      let newStatus: string | null = null;
      if (anetStatus === "suspended") newStatus = "past_due";
      else if (anetStatus === "terminated" || anetStatus === "expired") {
        newStatus = "terminated";
      } else if (anetStatus === "canceled" || anetStatus === "cancelled") {
        newStatus = "canceled";
      } else if (anetStatus === "active" && sub.subscription_status !== "active") {
        // Was flagged past_due in our DB but Authorize.net says it's active
        // again (card got fixed) — flip it back.
        newStatus = "active";
      }

      if (newStatus && newStatus !== sub.subscription_status) {
        await client.database
          .from("subscriptions")
          .update({
            subscription_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", sub.user_id);

        results.push({
          userId: sub.user_id,
          subscriptionId,
          action: `status: ${sub.subscription_status} → ${newStatus}`,
        });
      }

      // ─── Renewal detection ───────────────────────────────────────────────
      const latest = anet.lastTransaction;
      if (!latest || !latest.submitTimeUTC) continue;

      const latestPaidAt = new Date(latest.submitTimeUTC);
      const ourStartDate = sub.billing_cycle_start_date
        ? new Date(sub.billing_cycle_start_date as string)
        : null;

      const missedRenewal =
        latest.payNum !== "1" &&
        (!ourStartDate || latestPaidAt.getTime() > ourStartDate.getTime());

      if (missedRenewal) {
        // Check we haven't already recorded this transaction
        const { data: existingPayment } = await client.database
          .from("payment_records")
          .select("id")
          .eq("anet_transaction_id", latest.transId)
          .maybeSingle();

        if (!existingPayment) {
          const newPeriodEnd = computePeriodEnd(billingInterval, latestPaidAt);
          const amount =
            billingInterval === "monthly" ? 59.99 : 599.88;

          await client.database
            .from("subscriptions")
            .update({
              subscription_status: "active",
              billing_cycle_start_date: latestPaidAt.toISOString(),
              current_period_end: newPeriodEnd.toISOString(),
              next_billing_date: newPeriodEnd.toISOString(),
              last_payment_date: latestPaidAt.toISOString(),
              last_payment_amount: amount,
              last_payment_status: "success",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);

          await client.database.from("payment_records").insert({
            user_id: sub.user_id,
            anet_transaction_id: latest.transId,
            type: "renewal",
            amount,
            status: "success",
            billing_interval: billingInterval,
            description: `MyProfitPulse Pro ${billingInterval} — renewal (reconciled, payNum ${latest.payNum})`,
          });

          results.push({
            userId: sub.user_id,
            subscriptionId,
            action: "renewal reconciled",
            detail: `payNum ${latest.payNum}, transId ${latest.transId}`,
          });
        }
      }
    } catch (err) {
      console.error(
        `[arb-reconcile] failed for subscription ${subscriptionId}:`,
        err
      );
      results.push({
        userId: sub.user_id,
        subscriptionId,
        action: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `[arb-reconcile] processed ${subs?.length ?? 0} subscriptions, ${results.length} actions`
  );

  return NextResponse.json({
    processed: subs?.length ?? 0,
    actions: results,
  });
}
