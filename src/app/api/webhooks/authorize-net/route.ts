import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@insforge/sdk";
import {
  getTransactionDetails,
  computePeriodEnd,
  getPlanAmount,
} from "@/lib/authorize-net";
import type { BillingInterval } from "@/components/payments/PricingCards";

/**
 * POST /api/webhooks/authorize-net
 *
 * Receives Authorize.net webhook events for subscription lifecycle changes.
 *
 * Handled events (from PAYMENTS_PLAN.md Flow 3):
 *   - net.authorize.payment.authcapture.created
 *     ARB successfully charged a renewal. Payload does NOT include the
 *     subscription ID, so we call getTransactionDetails to find it, then
 *     update the user's subscription row + insert a payment record.
 *
 *   - net.authorize.customer.subscription.suspended
 *     ARB failed to charge. Mark user past_due → triggers dunning banner
 *     and 3-day grace period in feature-gate.
 *
 *   - net.authorize.customer.subscription.terminated
 *     ARB gave up after repeated failures. Mark user terminated.
 *
 *   - net.authorize.customer.subscription.cancelled
 *     User or merchant explicitly cancelled the ARB.
 *
 * Signature verification: HMAC-SHA512 of the raw request body, keyed with
 * ANET_SIGNATURE_KEY (decoded from hex). Compared against the
 * `X-ANET-Signature` header (format: `sha512=<HEX>`).
 *
 * ⚠ The handler always returns 200 to Authorize.net (unless signature
 * verification fails), even if downstream processing fails. Authorize.net
 * retries 5xx responses and will eventually deactivate webhooks that
 * consistently fail — we'd rather log and investigate than thrash.
 */

export const dynamic = "force-dynamic";

interface WebhookEvent {
  notificationId?: string;
  eventType?: string;
  eventDate?: string;
  webhookId?: string;
  payload?: {
    entityName?: string;
    id?: string;
    name?: string;
    amount?: number;
    status?: string;
    responseCode?: number;
    authAmount?: number;
  };
}

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const signatureKey = process.env.ANET_SIGNATURE_KEY;
  if (!signatureKey) {
    console.error("[webhook] ANET_SIGNATURE_KEY not set");
    return false;
  }

  // Authorize.net signature keys are hex strings; decode before using as HMAC key
  const keyBuf = Buffer.from(signatureKey, "hex");
  const expected = crypto
    .createHmac("sha512", keyBuf)
    .update(rawBody, "utf8")
    .digest("hex")
    .toUpperCase();

  const received = header.replace(/^sha512=/i, "").toUpperCase();

  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}

function getInsForgeClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("x-anet-signature") ??
    request.headers.get("X-ANET-Signature");

  if (!verifySignature(rawBody, signatureHeader)) {
    console.warn("[webhook] signature verification failed");
    return new NextResponse("invalid signature", { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    console.warn("[webhook] invalid JSON body");
    return new NextResponse("invalid json", { status: 400 });
  }

  // ⚠ Always return 200 from here on — we log errors and keep Authorize.net happy.
  try {
    await processEvent(event);
  } catch (err) {
    console.error(
      `[webhook] processing failed for ${event.eventType}:`,
      err
    );
  }

  return NextResponse.json({ ok: true });
}

async function processEvent(event: WebhookEvent): Promise<void> {
  const eventType = event.eventType;
  const payload = event.payload ?? {};

  console.log(`[webhook] received ${eventType}`);

  const client = getInsForgeClient();

  switch (eventType) {
    case "net.authorize.payment.authcapture.created": {
      const transId = payload.id;
      if (!transId) {
        console.warn("[webhook] authcapture event missing transaction id");
        return;
      }

      // Look up transaction details to find the subscription ID
      const details = await getTransactionDetails(transId);

      if (!details.subscriptionId) {
        // Not a recurring charge — probably the initial subscribe transaction,
        // which we already handle synchronously in /api/payments/subscribe.
        console.log(
          `[webhook] authcapture ${transId} has no subscription — ignoring`
        );
        return;
      }

      // Find the user by anet_subscription_id
      const { data: sub } = await client.database
        .from("subscriptions")
        .select("*")
        .eq("anet_subscription_id", details.subscriptionId)
        .maybeSingle();

      if (!sub) {
        console.warn(
          `[webhook] no subscription row found for anet_subscription_id=${details.subscriptionId}`
        );
        return;
      }

      // Skip the first charge (payNum == "1") — it's handled by /subscribe
      if (details.payNum === "1") {
        console.log(
          `[webhook] skipping payNum=1 for sub ${details.subscriptionId} (handled by /subscribe)`
        );
        return;
      }

      const now = new Date();
      const billingInterval = sub.billing_interval as BillingInterval;
      const periodEnd = computePeriodEnd(billingInterval, now);
      const amount = details.amount ?? getPlanAmount(billingInterval);

      const { error: updateError } = await client.database
        .from("subscriptions")
        .update({
          subscription_status: "active",
          billing_cycle_start_date: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          next_billing_date: periodEnd.toISOString(),
          last_payment_date: now.toISOString(),
          last_payment_amount: amount,
          last_payment_status: "success",
          updated_at: now.toISOString(),
        })
        .eq("user_id", sub.user_id);

      if (updateError) {
        console.error("[webhook] failed to update subscription:", updateError);
        return;
      }

      const { error: paymentError } = await client.database
        .from("payment_records")
        .insert({
          user_id: sub.user_id,
          anet_transaction_id: transId,
          type: "renewal",
          amount,
          status: "success",
          billing_interval: billingInterval,
          description: `ProfitPulse Pro ${billingInterval} — renewal (payNum ${details.payNum})`,
        });

      if (paymentError) {
        console.error("[webhook] failed to insert payment record:", paymentError);
      }

      return;
    }

    case "net.authorize.customer.subscription.suspended": {
      const subscriptionId = payload.id;
      if (!subscriptionId) return;

      const now = new Date();
      // Set last_payment_date to now so the 3-day grace period window in
      // feature-gate.ts starts counting from the failure.
      const { error } = await client.database
        .from("subscriptions")
        .update({
          subscription_status: "past_due",
          last_payment_status: "failed",
          last_payment_date: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("anet_subscription_id", subscriptionId);

      if (error) {
        console.error("[webhook] failed to mark past_due:", error);
      }
      return;
    }

    case "net.authorize.customer.subscription.terminated": {
      const subscriptionId = payload.id;
      if (!subscriptionId) return;

      const { error } = await client.database
        .from("subscriptions")
        .update({
          subscription_status: "terminated",
          updated_at: new Date().toISOString(),
        })
        .eq("anet_subscription_id", subscriptionId);

      if (error) {
        console.error("[webhook] failed to mark terminated:", error);
      }
      return;
    }

    case "net.authorize.customer.subscription.cancelled": {
      const subscriptionId = payload.id;
      if (!subscriptionId) return;

      const { error } = await client.database
        .from("subscriptions")
        .update({
          subscription_status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("anet_subscription_id", subscriptionId);

      if (error) {
        console.error("[webhook] failed to mark canceled:", error);
      }
      return;
    }

    case "net.authorize.customer.subscription.created": {
      // We create the ARB synchronously in /api/payments/subscribe, so this
      // event is effectively a confirmation. Nothing to do.
      console.log("[webhook] subscription.created — no action needed");
      return;
    }

    default:
      console.log(`[webhook] unhandled event type: ${eventType}`);
  }
}
