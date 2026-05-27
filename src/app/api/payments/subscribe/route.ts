import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  ensureCustomerProfileWithPayment,
  createCustomerPaymentProfile,
  chargeCustomerProfile,
  createARBSubscription,
  getPlanAmount,
  computePeriodEnd,
} from "@/lib/authorize-net";
import type { BillingInterval } from "@/components/payments/PricingCards";

interface SubscribeRequestBody {
  userId: string;
  billingInterval: BillingInterval;
  /** New nonce from Accept.js. Optional only when user opts to reuse the
   *  card already on file (see `useExistingCard`). */
  nonce?: {
    dataDescriptor: string;
    dataValue: string;
  };
  /** When true and the user already has a stored customer profile, charge
   *  that profile directly without needing a new nonce. */
  useExistingCard?: boolean;
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
 * Handles three scenarios from PAYMENTS_PLAN.md:
 *
 *   Scenario A — Fresh signup (Flow 2, no existing customer profile):
 *     1. createCustomerProfileWithPayment(nonce) — vault card
 *     2. chargeCustomerProfile — first period
 *     3. createARBSubscription
 *
 *   Scenario B — Resubscribe with same card (Flow 7, useExistingCard=true):
 *     1. chargeCustomerProfile(existing customerProfileId + paymentProfileId)
 *     2. createARBSubscription
 *
 *   Scenario C — Resubscribe with new card (Flow 7, nonce + existing profile):
 *     1. createCustomerPaymentProfile(existing profileId, nonce) → new paymentProfileId
 *     2. chargeCustomerProfile(existing profileId + new paymentProfileId)
 *     3. createARBSubscription
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

  const amount = getPlanAmount(body.billingInterval);
  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Check if this user already has a stored customer profile (resubscribe flow)
  const { data: existingSub } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", body.userId)
    .maybeSingle();

  const hasStoredProfile = Boolean(
    existingSub?.anet_customer_profile_id && existingSub?.anet_payment_profile_id
  );

  if (existingSub?.subscription_status === "active") {
    return NextResponse.json(
      { error: "You already have an active subscription" },
      { status: 400 }
    );
  }

  // Determine which scenario
  let scenario: "A-fresh" | "B-reuse-card" | "C-new-card";
  if (!hasStoredProfile) {
    scenario = "A-fresh";
  } else if (body.useExistingCard) {
    scenario = "B-reuse-card";
  } else {
    scenario = "C-new-card";
  }

  if (scenario !== "B-reuse-card" && (!body.nonce?.dataDescriptor || !body.nonce?.dataValue)) {
    return NextResponse.json(
      { error: "Payment nonce is missing or malformed" },
      { status: 400 }
    );
  }

  try {
    let transactionId: string;
    let customerProfileId: string;
    let customerPaymentProfileId: string;

    if (scenario === "A-fresh") {
      // ─── Scenario A: Fresh signup ────────────────────────────────────────
      const profile = await ensureCustomerProfileWithPayment({
        merchantCustomerId: body.userId,
        email: body.customer?.email,
        description: `ProfitPulse user ${body.userId}`,
        nonce: body.nonce!,
        billTo: {
          firstName: body.customer?.firstName,
          lastName: body.customer?.lastName,
          zip: body.customer?.zip,
        },
      });
      customerProfileId = profile.customerProfileId;
      customerPaymentProfileId = profile.customerPaymentProfileId;

      const txn = await chargeCustomerProfile({
        amount,
        customerProfileId,
        customerPaymentProfileId,
        description: `ProfitPulse Pro — ${body.billingInterval} (first period)`,
        email: body.customer?.email,
      });
      transactionId = txn.transId;
    } else {
      // ─── Scenarios B + C: Resubscribe with existing customer profile ─────
      customerProfileId = existingSub!.anet_customer_profile_id as string;

      if (scenario === "C-new-card") {
        // Add a new payment profile under the existing customer
        try {
          const newProfile = await createCustomerPaymentProfile({
            customerProfileId,
            nonce: body.nonce!,
            billTo: {
              firstName: body.customer?.firstName,
              lastName: body.customer?.lastName,
              zip: body.customer?.zip,
            },
          });
          customerPaymentProfileId = newProfile.customerPaymentProfileId;
        } catch (profileErr: unknown) {
          // If duplicate card or invalid fields, fall back to existing payment profile
          const msg = profileErr instanceof Error ? profileErr.message : String(profileErr);
          console.warn("createCustomerPaymentProfile failed, falling back to existing profile:", msg);
          if (existingSub?.anet_payment_profile_id) {
            customerPaymentProfileId = existingSub.anet_payment_profile_id as string;
          } else {
            throw profileErr;
          }
        }
      } else {
        // Scenario B: reuse the stored payment profile
        customerPaymentProfileId = existingSub!.anet_payment_profile_id as string;
      }

      // Charge the first period via the stored profile
      const txn = await chargeCustomerProfile({
        amount,
        customerProfileId,
        customerPaymentProfileId,
        description: `ProfitPulse Pro — ${body.billingInterval} (resubscribe)`,
        email: body.customer?.email,
      });
      transactionId = txn.transId;
    }

    // ─── Create the ARB for ongoing billing ──────────────────────────────
    const now = new Date();
    const periodEnd = computePeriodEnd(body.billingInterval, now);

    const arb = await createARBSubscription({
      billingInterval: body.billingInterval,
      customerProfileId,
      customerPaymentProfileId,
      nextBillingDate: periodEnd,
      customerEmail: body.customer?.email,
    });

    // ─── Update subscriptions row ────────────────────────────────────────
    const subscriptionUpdate = {
      plan: "pro" as const,
      billing_interval: body.billingInterval,
      subscription_status: "active" as const,
      anet_customer_profile_id: customerProfileId,
      anet_payment_profile_id: customerPaymentProfileId,
      anet_subscription_id: arb.subscriptionId,
      billing_cycle_start_date: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_date: periodEnd.toISOString(),
      last_payment_date: now.toISOString(),
      last_payment_amount: amount,
      last_payment_status: "success" as const,
      pending_switch_to: null,
      pending_switch_sub_id: null,
      updated_at: now.toISOString(),
    };

    const { error: upsertError } = await client.database
      .from("subscriptions")
      .upsert(
        { user_id: body.userId, ...subscriptionUpdate },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[subscribe] Failed to update subscription:", upsertError);
      return NextResponse.json(
        {
          warning:
            "Payment succeeded but we couldn't update your account. Contact support.",
          transactionId,
        },
        { status: 200 }
      );
    }

    const isResubscribe = scenario !== "A-fresh";
    const { error: paymentError } = await client.database
      .from("payment_records")
      .insert({
        user_id: body.userId,
        anet_transaction_id: transactionId,
        type: "subscription",
        amount,
        status: "success",
        billing_interval: body.billingInterval,
        description: `ProfitPulse Pro ${body.billingInterval} — ${
          isResubscribe ? "resubscribe" : "first period"
        }`,
      });

    if (paymentError) {
      console.error("[subscribe] Failed to insert payment record:", paymentError);
    }

    return NextResponse.json({
      success: true,
      scenario,
      transactionId,
      subscriptionId: arb.subscriptionId,
      customerProfileId,
      currentPeriodEnd: periodEnd.toISOString(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Payment processing failed";
    console.error("[subscribe] Error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
