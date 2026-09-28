import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql, logAdminAction } from "@/lib/admin-log";
import { getTransactionDetails, refundTransaction, voidTransaction } from "@/lib/authorize-net";
import { owesMissedRenewal, settleMissedRenewal } from "@/lib/missed-renewal";
import { cancelSubscription } from "@/lib/cancel-subscription";
import { switchPlan } from "@/lib/plan-switch";
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend";
import type { Subscription } from "@/lib/database.types";

type BillingAction =
  | "retry_payment"
  | "cancel_subscription"
  | "switch_plan"
  | "refund_payment"
  | "send_update_card_link";

/** Unsettled statuses can be voided (never billed); settled ones are refunded. */
const VOIDABLE = new Set([
  "authorizedPendingCapture",
  "capturedPendingSettlement",
  "FDSPendingReview",
  "FDSAuthorizedPendingReview",
]);

/**
 * POST /api/admin/billing
 * Body: { userId, action, target?: "monthly" | "annual", paymentId?: string }
 *
 * Billing changes an admin makes on a customer's behalf. Card numbers are
 * never involved: charges use the card already on file, refunds only need
 * Authorize.net's last four digits, and a new card is always entered by the
 * customer through the emailed update-card link.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: string; action?: string; target?: string; paymentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  const action = body.action as BillingAction;
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  const users = await adminSql<{ email: string }>("SELECT email FROM auth.users WHERE id = $1", [userId]);
  const email = users?.[0]?.email;
  if (!email || email.endsWith("@deleted.invalid")) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const client = getInsForgeAdmin();
  const { data } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const sub = data as Subscription | null;

  switch (action) {
    case "retry_payment": {
      if (!sub || !owesMissedRenewal(sub)) {
        return NextResponse.json({ error: "They don't have a missed payment to collect." }, { status: 409 });
      }
      if (!sub.anet_payment_profile_id) {
        return NextResponse.json(
          { error: "There's no card on file. Send them the update-card link instead." },
          { status: 400 }
        );
      }
      try {
        const result = await settleMissedRenewal(sub, sub.anet_payment_profile_id, email);
        if (result.status === "paid") {
          await logAdminAction(admin, "retry_payment", { userId, email }, {
            amount: result.amount,
            transId: result.transId,
          });
          return NextResponse.json({ success: true, amount: result.amount });
        }
        if (result.status === "declined") {
          await logAdminAction(admin, "retry_payment", { userId, email }, {
            amount: result.amount,
            declined: result.reason,
          });
          return NextResponse.json(
            { error: `Their card was declined again (${result.reason}). Send them the update-card link.` },
            { status: 402 }
          );
        }
        if (result.status === "left_to_authorize_net") {
          return NextResponse.json(
            {
              error:
                "Authorize.net has paused this subscription. It retries the charge itself once they update their card, so send them the update-card link.",
            },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: "They don't have a missed payment to collect." }, { status: 409 });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "The charge didn't go through." },
          { status: 502 }
        );
      }
    }

    case "cancel_subscription": {
      const res = await cancelSubscription(userId);
      if (res.ok) {
        await logAdminAction(admin, "cancel_subscription", { userId, email }, {
          access_until: sub?.current_period_end ?? null,
        });
      }
      return res;
    }

    case "switch_plan": {
      if (body.target !== "monthly" && body.target !== "annual") {
        return NextResponse.json({ error: "Choose monthly or annual." }, { status: 400 });
      }
      const res = await switchPlan(userId, body.target);
      if (res.ok) {
        await logAdminAction(admin, "switch_plan", { userId, email }, {
          from: sub?.billing_interval ?? null,
          to: body.target,
        });
      }
      return res;
    }

    case "refund_payment": {
      if (!body.paymentId) {
        return NextResponse.json({ error: "paymentId required" }, { status: 400 });
      }
      const { data: payment } = await client.database
        .from("payment_records")
        .select("*")
        .eq("id", body.paymentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!payment || payment.status !== "success" || !payment.anet_transaction_id) {
        return NextResponse.json({ error: "That payment can't be refunded." }, { status: 409 });
      }

      try {
        const details = await getTransactionDetails(payment.anet_transaction_id);
        const status = details.transactionStatus ?? "";
        const amount = Number(payment.amount);
        let outcome: "voided" | "refunded";

        if (VOIDABLE.has(status)) {
          await voidTransaction(payment.anet_transaction_id);
          outcome = "voided";
        } else if (status === "settledSuccessfully") {
          if (!details.cardLast4) {
            return NextResponse.json(
              { error: "Couldn't find the card this was charged to. Refund it in the Authorize.net portal." },
              { status: 409 }
            );
          }
          await refundTransaction({
            transId: payment.anet_transaction_id,
            amount,
            cardLast4: details.cardLast4,
          });
          outcome = "refunded";
        } else {
          return NextResponse.json(
            { error: `Authorize.net shows this payment as "${status || "unknown"}", so it can't be refunded here.` },
            { status: 409 }
          );
        }

        await client.database
          .from("payment_records")
          .update({
            status: outcome,
            description: `${payment.description} (${outcome} by admin)`,
          })
          .eq("id", payment.id);

        await logAdminAction(admin, "refund_payment", { userId, email }, {
          amount,
          transId: payment.anet_transaction_id,
          outcome,
        });

        return NextResponse.json({ success: true, outcome, amount });
      } catch (err) {
        return NextResponse.json(
          { error: `The refund didn't go through: ${err instanceof Error ? err.message : "unknown error"}` },
          { status: 502 }
        );
      }
    }

    case "send_update_card_link": {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://myprofitpulse.app";
      try {
        await getResend().emails.send({
          from: FROM_EMAIL,
          replyTo: REPLY_TO_EMAIL,
          to: email,
          subject: "Update your card for MyProfitPulse",
          html: `<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #2D2A26;">
            <h2 style="font-family: Georgia, serif; font-weight: normal;">Update your card</h2>
            <p>Please update the card we have on file for your MyProfitPulse subscription. It only takes a minute, and your card details go straight to our secure payment processor.</p>
            <p style="margin: 28px 0;">
              <a href="${appUrl}/billing" style="background: #E65100; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none;">Update my card</a>
            </p>
            <p style="color: #6B6560; font-size: 14px;">You'll be asked to log in first. Questions? Just reply to this email.</p>
          </div>`,
        });
      } catch (err) {
        console.error("[admin/billing] update-card email failed:", err);
        return NextResponse.json({ error: "The email didn't send. Try again." }, { status: 502 });
      }
      await logAdminAction(admin, "send_update_card_link", { userId, email });
      return NextResponse.json({ success: true, email });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
