import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  createTransaction,
  createCustomerProfileFromTransaction,
  createARBSubscription,
  getPlanAmount,
  computePeriodEnd,
} from "@/lib/authorize-net";
import type { BillingInterval } from "@/components/payments/PricingCards";

interface SubscribeRequestBody {
  userId: string;
  billingInterval: BillingInterval;
  nonce: {
    dataDescriptor: string;
    dataValue: string;
  };
  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    zip?: string;
  };
}

/**
 * POST /api/payments/subscribe
 *
 * Executes Flow 2 from PAYMENTS_PLAN.md:
 *   1. Charge first period in real time (createTransaction)
 *   2. Vault the card (createCustomerProfileFromTransaction)
 *   3. Create recurring ARB subscription
 *   4. Update subscriptions row in InsForge
 *   5. Insert payment_records row
 *   6. Return success
 *
 * If any step fails, returns a 400/500 with a descriptive error. The user
 * can then retry from the frontend.
 */
export async function POST(request: NextRequest) {
  let body: SubscribeRequestBody;
  try {
    body = (await request.json()) as SubscribeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (body.billingInterval !== "monthly" && body.billingInterval !== "annual") {
    return NextResponse.json(
      { error: "billingInterval must be 'monthly' or 'annual'" },
      { status: 400 }
    );
  }
  if (!body.nonce?.dataDescriptor || !body.nonce?.dataValue) {
    return NextResponse.json(
      { error: "Payment nonce is missing or malformed" },
      { status: 400 }
    );
  }

  const amount = getPlanAmount(body.billingInterval);

  try {
    // ─── Step 1: Charge first period ────────────────────────────────────────
    const transaction = await createTransaction({
      amount,
      nonce: body.nonce,
      customer: body.customer,
      description: `ProfitPulse Pro — ${body.billingInterval} (first period)`,
    });

    // ─── Step 2: Vault the card as a Customer Profile ───────────────────────
    const profile = await createCustomerProfileFromTransaction(transaction.transId);

    // ─── Step 3: Create ARB subscription for ongoing billing ────────────────
    const now = new Date();
    const periodEnd = computePeriodEnd(body.billingInterval, now);

    const arb = await createARBSubscription({
      billingInterval: body.billingInterval,
      customerProfileId: profile.customerProfileId,
      customerPaymentProfileId: profile.customerPaymentProfileId,
      nextBillingDate: periodEnd,
      customerEmail: body.customer?.email,
    });

    // ─── Step 4 + 5: Update InsForge ────────────────────────────────────────
    const client = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    });

    const subscriptionUpdate = {
      plan: "pro" as const,
      billing_interval: body.billingInterval,
      subscription_status: "active" as const,
      anet_customer_profile_id: profile.customerProfileId,
      anet_payment_profile_id: profile.customerPaymentProfileId,
      anet_subscription_id: arb.subscriptionId,
      billing_cycle_start_date: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_date: periodEnd.toISOString(),
      last_payment_date: now.toISOString(),
      last_payment_amount: amount,
      last_payment_status: "success" as const,
      updated_at: now.toISOString(),
    };

    // Upsert — if no row exists yet, create one; otherwise update
    const { error: upsertError } = await client.database
      .from("subscriptions")
      .upsert(
        { user_id: body.userId, ...subscriptionUpdate },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[subscribe] Failed to update subscription:", upsertError);
      // Payment DID succeed — return a warning but don't fail the request,
      // so the user doesn't get double-charged on retry.
      return NextResponse.json(
        {
          warning:
            "Payment succeeded but we couldn't update your account. Contact support.",
          transactionId: transaction.transId,
        },
        { status: 200 }
      );
    }

    // Payment record
    const { error: paymentError } = await client.database
      .from("payment_records")
      .insert({
        user_id: body.userId,
        anet_transaction_id: transaction.transId,
        type: "subscription",
        amount,
        status: "success",
        billing_interval: body.billingInterval,
        description: `ProfitPulse Pro ${body.billingInterval} — first period`,
      });

    if (paymentError) {
      // Log but don't fail — the subscription is active
      console.error("[subscribe] Failed to insert payment record:", paymentError);
    }

    // ─── Step 6: Return success ─────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      transactionId: transaction.transId,
      subscriptionId: arb.subscriptionId,
      customerProfileId: profile.customerProfileId,
      currentPeriodEnd: periodEnd.toISOString(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Payment processing failed";
    console.error("[subscribe] Error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
