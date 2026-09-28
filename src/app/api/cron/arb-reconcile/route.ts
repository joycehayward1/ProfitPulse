import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import {
  getARBSubscription,
  getTransactionDetails,
  computePeriodEnd,
  getPlanAmount,
} from "@/lib/authorize-net";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { notifyPaymentDeclined, sendTrialEmails } from "@/lib/lifecycle-emails";
import type { PricingPromo } from "@/lib/plan-amounts";
import type { BillingInterval } from "@/components/payments/PricingCards";

/**
 * GET /api/cron/arb-reconcile
 *
 * Daily reconciliation job — the safety net behind the Authorize.net webhook.
 * For every subscription with an ARB ID:
 *
 * 1. Every ARB charge attempt newer than our billing_cycle_start_date that we
 *    haven't recorded is looked up with getTransactionDetails (the reliable
 *    source of the result code):
 *      - approved → a renewal we missed: extend the paid period, record it
 *      - declined / error → record the failed attempt
 * 2. Status is then set from Authorize.net plus those outcomes:
 *      - suspended → past_due; terminated/expired → terminated; canceled → canceled
 *      - active, but the latest attempt was declined → past_due (dunning banner
 *        + grace period). Authorize.net only suspends a subscription when its
 *        FIRST payment fails; later declines leave it "active".
 *      - active otherwise → active
 * 3. If anything changed or failed, the admins get an email summary.
 * 4. Trial reminder emails go out (ends in 2 days / ended), once each.
 *
 * Runs daily (vercel.json). Secured by CRON_SECRET — Vercel cron sends the
 * header automatically; manual calls need `Authorization: Bearer <CRON_SECRET>`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  if (!header || !process.env.CRON_SECRET) return false;
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

interface ReconcileResult {
  userId: string;
  subscriptionId: string;
  action: string;
  detail?: string;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getInsForgeAdmin();

  const { data: subs, error: fetchError } = await client.database
    .from("subscriptions")
    .select("*")
    .not("anet_subscription_id", "is", null)
    .in("subscription_status", ["active", "past_due", "canceled"]);

  if (fetchError) {
    console.error("[arb-reconcile] failed to fetch subscriptions:", fetchError);
    return NextResponse.json({ error: "db fetch failed" }, { status: 500 });
  }

  const results: ReconcileResult[] = [];

  for (const sub of subs ?? []) {
    const subscriptionId = sub.anet_subscription_id as string;
    const billingInterval = sub.billing_interval as BillingInterval;
    const promo = ((sub.pricing_promo as PricingPromo | null) ?? "standard") as PricingPromo;

    try {
      const anet = await getARBSubscription(subscriptionId);

      // ─── 1. Charge attempts we haven't recorded ───────────────────────────
      const since = sub.billing_cycle_start_date
        ? new Date(sub.billing_cycle_start_date as string).getTime()
        : 0;
      const candidates = anet.transactions.filter(
        (t) => new Date(t.submitTimeUTC).getTime() > since
      );

      // Outcome of the most recent attempt processed (or already on file).
      let latestOutcome: "success" | "failed" | null =
        sub.last_payment_status === "failed" ? "failed" : null;

      for (const attempt of candidates) {
        const { data: existing } = await client.database
          .from("payment_records")
          .select("status")
          .eq("anet_transaction_id", attempt.transId)
          .maybeSingle();
        if (existing) {
          latestOutcome = existing.status === "success" ? "success" : "failed";
          continue;
        }

        const details = await getTransactionDetails(attempt.transId);
        const attemptedAt = new Date(details.submitTimeUTC || attempt.submitTimeUTC);
        const amount = details.amount ?? getPlanAmount(billingInterval, promo);

        if (details.responseCode === 1) {
          const periodEnd = computePeriodEnd(billingInterval, attemptedAt);
          await client.database
            .from("subscriptions")
            .update({
              billing_cycle_start_date: attemptedAt.toISOString(),
              current_period_end: periodEnd.toISOString(),
              next_billing_date: periodEnd.toISOString(),
              last_payment_date: attemptedAt.toISOString(),
              last_payment_amount: amount,
              last_payment_status: "success",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);

          await client.database.from("payment_records").insert([
            {
              user_id: sub.user_id,
              anet_transaction_id: attempt.transId,
              type: "renewal",
              amount,
              status: "success",
              billing_interval: billingInterval,
              description: `MyProfitPulse Pro ${billingInterval} — renewal (reconciled, payNum ${attempt.payNum})`,
            },
          ]);

          latestOutcome = "success";
          results.push({
            userId: sub.user_id,
            subscriptionId,
            action: "missed renewal recorded",
            detail: `$${amount} on ${attemptedAt.toISOString().slice(0, 10)}, transId ${attempt.transId}`,
          });
        } else if (details.responseCode === 2 || details.responseCode === 3) {
          await client.database
            .from("subscriptions")
            .update({
              last_payment_date: attemptedAt.toISOString(),
              last_payment_amount: amount,
              last_payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);

          await client.database.from("payment_records").insert([
            {
              user_id: sub.user_id,
              anet_transaction_id: attempt.transId,
              type: "renewal",
              amount,
              status: "failed",
              billing_interval: billingInterval,
              description: `MyProfitPulse Pro ${billingInterval} — renewal declined (payNum ${attempt.payNum})`,
            },
          ]);

          latestOutcome = "failed";
          await notifyPaymentDeclined(sub.user_id, attempt.transId, amount);
          results.push({
            userId: sub.user_id,
            subscriptionId,
            action: "declined renewal recorded",
            detail: `$${amount} on ${attemptedAt.toISOString().slice(0, 10)}, transId ${attempt.transId}`,
          });
        }
        // responseCode 4 (held for review) or unknown: leave for the next run.
      }

      // ─── 2. Status ─────────────────────────────────────────────────────────
      const anetStatus = anet.status.toLowerCase();
      let newStatus: string | null = null;
      if (anetStatus === "suspended") newStatus = "past_due";
      else if (anetStatus === "terminated" || anetStatus === "expired") newStatus = "terminated";
      else if (anetStatus === "canceled" || anetStatus === "cancelled") newStatus = "canceled";
      else if (anetStatus === "active") {
        newStatus = latestOutcome === "failed" ? "past_due" : "active";
      }

      if (newStatus && newStatus !== sub.subscription_status) {
        await client.database
          .from("subscriptions")
          .update({ subscription_status: newStatus, updated_at: new Date().toISOString() })
          .eq("user_id", sub.user_id);

        results.push({
          userId: sub.user_id,
          subscriptionId,
          action: `status: ${sub.subscription_status} → ${newStatus}`,
        });
      }
    } catch (err) {
      console.error(`[arb-reconcile] failed for subscription ${subscriptionId}:`, err);
      results.push({
        userId: sub.user_id,
        subscriptionId,
        action: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `[arb-reconcile] processed ${subs?.length ?? 0} subscriptions, ${results.length} actions`,
    results.length ? JSON.stringify(results) : ""
  );

  if (results.length > 0) {
    await emailAdmins(results);
  }

  // Also daily: trial ending / trial ended emails (each sent once).
  const trialEmails = await sendTrialEmails();
  console.log(`[arb-reconcile] trial emails sent`, JSON.stringify(trialEmails));

  return NextResponse.json({ processed: subs?.length ?? 0, actions: results, trialEmails });
}

/** Tell the admins what the nightly job changed or couldn't do. Never throws. */
async function emailAdmins(results: ReconcileResult[]): Promise<void> {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (admins.length === 0) return;

  try {
    const { data: users } = await getInsForgeAdmin()
      .database.from("profiles")
      .select("user_id, business_name")
      .in(
        "user_id",
        results.map((r) => r.userId)
      );
    const names = new Map((users ?? []).map((u) => [String(u.user_id), u.business_name as string]));

    const errors = results.filter((r) => r.action === "error").length;
    const rows = results
      .map(
        (r) =>
          `<li><strong>${names.get(r.userId) || r.userId}</strong> (ARB ${r.subscriptionId}): ${r.action}${
            r.detail ? ` — ${r.detail}` : ""
          }</li>`
      )
      .join("");

    await getResend().emails.send({
      from: FROM_EMAIL,
      to: admins,
      subject: `MyProfitPulse billing check: ${results.length} change${results.length === 1 ? "" : "s"}${
        errors ? `, ${errors} error${errors === 1 ? "" : "s"}` : ""
      }`,
      html: `<div style="font-family: Arial, sans-serif; color: #2D2A26;">
        <p>The nightly billing check against Authorize.net made these updates:</p>
        <ul>${rows}</ul>
        <p style="color:#6B6560;">Declined renewals put the customer in "payment failed" — they see an update-card banner. Details are in the admin panel.</p>
      </div>`,
    });
  } catch (err) {
    console.error("[arb-reconcile] admin email failed:", err);
  }
}
