import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  cancelARBSubscription,
  chargeCustomerProfile,
  createARBSubscription,
  computePeriodEnd,
  getCustomerProfile,
  anetInvoiceNumber,
} from "@/lib/authorize-net";
import { getPlanAmount, isLiveTestPricing } from "@/lib/plan-amounts";
import type { BillingInterval } from "@/components/payments/PricingCards";

/**
 * POST /api/payments/switch-plan
 *
 * Body: { userId: string, target: "monthly" | "annual" }
 *
 * Handles both directions from PAYMENTS_PLAN.md:
 *
 * Flow 4 — Monthly → Annual:
 *   1. Cancel current monthly ARB
 *   2. Charge $599.88 immediately via stored Customer Profile
 *      (if it fails, rollback: re-create the monthly ARB)
 *   3. Create new annual ARB starting today + 365 days
 *   4. Update subscriptions row (billing_interval=annual, new period end)
 *   5. Insert payment_records row (type=plan_switch)
 *
 * Flow 5 — Annual → Monthly:
 *   1. Cancel current annual ARB
 *   2. Create new monthly ARB with startDate = current_period_end (dormant
 *      until the annual period expires)
 *   3. Update subscriptions row (still annual, pending_switch_to=monthly,
 *      pending_switch_sub_id=new sub id, anet_subscription_id=new monthly id)
 *
 * No charge happens in Flow 5 — the user already paid for the year.
 */

interface SwitchPlanBody {
  userId: string;
  target: BillingInterval;
}

interface SubscriptionRow {
  user_id: string;
  plan: string | null;
  billing_interval: BillingInterval | null;
  subscription_status: string | null;
  anet_customer_profile_id: string | null;
  anet_payment_profile_id: string | null;
  anet_subscription_id: string | null;
  current_period_end: string | null;
  pricing_promo?: "launch" | null;
}

export async function POST(request: NextRequest) {
  let body: SwitchPlanBody;
  try {
    body = (await request.json()) as SwitchPlanBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (body.target !== "monthly" && body.target !== "annual") {
    return NextResponse.json(
      { error: "target must be 'monthly' or 'annual'" },
      { status: 400 }
    );
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Fetch current subscription
  const { data: sub, error: fetchError } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", body.userId)
    .maybeSingle();

  if (fetchError || !sub) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }

  const current = sub as SubscriptionRow;

  // Guardrails
  if (current.subscription_status !== "active") {
    return NextResponse.json(
      { error: "Only active subscriptions can switch plans" },
      { status: 400 }
    );
  }
  if (current.billing_interval === body.target) {
    return NextResponse.json(
      { error: `Already on ${body.target} plan` },
      { status: 400 }
    );
  }
  if (
    !current.anet_subscription_id ||
    !current.anet_customer_profile_id ||
    !current.anet_payment_profile_id
  ) {
    return NextResponse.json(
      { error: "Subscription missing Authorize.net profile IDs" },
      { status: 500 }
    );
  }

  const oldSubscriptionId = current.anet_subscription_id;
  const customerProfileId = current.anet_customer_profile_id;
  const customerPaymentProfileId = current.anet_payment_profile_id;

  if (current.billing_interval === "monthly" && body.target === "annual") {
    return handleMonthlyToAnnual({
      client,
      userId: body.userId,
      oldSubscriptionId,
      customerProfileId,
      customerPaymentProfileId,
      currentPeriodEnd: current.current_period_end ? new Date(current.current_period_end) : undefined,
      pricingPromo: current.pricing_promo ?? null,
    });
  }

  if (current.billing_interval === "annual" && body.target === "monthly") {
    if (!current.current_period_end) {
      return NextResponse.json(
        { error: "Missing current_period_end on annual subscription" },
        { status: 500 }
      );
    }
    return handleAnnualToMonthly({
      client,
      userId: body.userId,
      oldSubscriptionId,
      customerProfileId,
      customerPaymentProfileId,
      currentPeriodEnd: new Date(current.current_period_end),
    });
  }

  return NextResponse.json({ error: "Unsupported switch" }, { status: 400 });
}

// ─── Flow 4: Monthly → Annual ────────────────────────────────────────────────

interface SwitchArgs {
  client: ReturnType<typeof createClient>;
  userId: string;
  oldSubscriptionId: string;
  customerProfileId: string;
  customerPaymentProfileId: string;
}

async function resolvePaymentProfileId(
  customerProfileId: string,
  storedPaymentProfileId: string
): Promise<string> {
  const profile = await getCustomerProfile(customerProfileId);
  if (profile.paymentProfileIds.includes(storedPaymentProfileId)) {
    return storedPaymentProfileId;
  }
  const fallback =
    profile.defaultPaymentProfileId ??
    profile.paymentProfileIds[profile.paymentProfileIds.length - 1];
  if (!fallback) {
    throw new Error("No valid payment profile found on file. Update your card and try again.");
  }
  console.warn(
    `[switch-plan] stored payment profile ${storedPaymentProfileId} not found; using ${fallback}`
  );
  return fallback;
}

async function handleMonthlyToAnnual(args: SwitchArgs & { currentPeriodEnd?: Date; pricingPromo?: "launch" | null }): Promise<NextResponse> {
  const { client, userId, oldSubscriptionId, customerProfileId, customerPaymentProfileId, currentPeriodEnd, pricingPromo } =
    args;
  const promo = pricingPromo === "launch" ? "launch" : "standard";
  const ANNUAL_AMOUNT = getPlanAmount("annual", promo);
  const MONTHLY_AMOUNT = getPlanAmount("monthly", promo);

  // Calculate proration credit for unused days of current monthly period
  let credit = 0;
  if (!isLiveTestPricing() && currentPeriodEnd) {
    const now = new Date();
    const periodEndDate = new Date(currentPeriodEnd);
    const daysRemaining = Math.max(0, Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const daysInMonth = 30;
    credit = Math.round((MONTHLY_AMOUNT * (daysRemaining / daysInMonth)) * 100) / 100;
  }

  const chargeAmount = isLiveTestPricing()
    ? ANNUAL_AMOUNT
    : Math.max(0.01, Math.round((ANNUAL_AMOUNT - credit) * 100) / 100);
  console.log(`[switch-plan] Annual upgrade: $${ANNUAL_AMOUNT} - $${credit} credit = $${chargeAmount}`);

  let paymentProfileId: string;
  try {
    paymentProfileId = await resolvePaymentProfileId(
      customerProfileId,
      customerPaymentProfileId
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment profile not found" },
      { status: 400 }
    );
  }

  // Step 1: Charge first (same order as subscribe/resubscribe — monthly ARB still active)
  let chargeResult;
  try {
    chargeResult = await chargeCustomerProfile({
      amount: chargeAmount,
      customerProfileId,
      customerPaymentProfileId: paymentProfileId,
      description: `MyProfitPulse Pro — upgrade to annual ($${credit} credit applied)`,
      invoiceNumber: anetInvoiceNumber("SW"),
    });
  } catch (err) {
    console.error("[switch-plan] annual charge failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Annual charge failed. Your monthly plan is unchanged.",
      },
      { status: 400 }
    );
  }

  // Step 2: Cancel current monthly ARB
  try {
    await cancelARBSubscription(oldSubscriptionId);
  } catch (err) {
    console.error("[switch-plan] cancel failed after charge:", err);
    return NextResponse.json(
      {
        error:
          "Annual charge succeeded but we could not cancel your monthly plan. Contact support — do not retry.",
        transactionId: chargeResult.transId,
      },
      { status: 500 }
    );
  }

  // Step 3: Create new annual ARB starting today + 365 days
  const now = new Date();
  const annualPeriodEnd = computePeriodEnd("annual", now);
  let newArbId: string;
  try {
    const arb = await createARBSubscription({
      billingInterval: "annual",
      customerProfileId,
      customerPaymentProfileId: paymentProfileId,
      nextBillingDate: annualPeriodEnd,
      amount: ANNUAL_AMOUNT,
    });
    newArbId = arb.subscriptionId;
  } catch (err) {
    console.error("[switch-plan] failed to create annual ARB:", err);
    return NextResponse.json(
      {
        warning:
          "Annual charge succeeded but ARB creation failed. Contact support.",
        transactionId: chargeResult.transId,
      },
      { status: 200 }
    );
  }

  // Step 4: Update InsForge
  const { error: updateError } = await client.database
    .from("subscriptions")
    .update({
      billing_interval: "annual",
      anet_subscription_id: newArbId,
      anet_payment_profile_id: paymentProfileId,
      billing_cycle_start_date: now.toISOString(),
      current_period_end: annualPeriodEnd.toISOString(),
      next_billing_date: annualPeriodEnd.toISOString(),
      last_payment_date: now.toISOString(),
      last_payment_amount: chargeAmount,
      last_payment_status: "success",
      pending_switch_to: null,
      pending_switch_sub_id: null,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[switch-plan] DB update failed:", updateError);
  }

  // Step 5: Payment record
  await client.database.from("payment_records").insert({
    user_id: userId,
    anet_transaction_id: chargeResult.transId,
    type: "plan_switch",
    amount: chargeAmount,
    status: "success",
    billing_interval: "annual",
    description: `Switched monthly→annual ($${credit.toFixed(2)} credit for unused days)`,
  });

  return NextResponse.json({
    success: true,
    switched: "monthly→annual",
    transactionId: chargeResult.transId,
    subscriptionId: newArbId,
    currentPeriodEnd: annualPeriodEnd.toISOString(),
  });
}

// ─── Flow 5: Annual → Monthly ────────────────────────────────────────────────

interface AnnualToMonthlyArgs extends SwitchArgs {
  currentPeriodEnd: Date;
}

async function handleAnnualToMonthly(
  args: AnnualToMonthlyArgs
): Promise<NextResponse> {
  const {
    client,
    userId,
    oldSubscriptionId,
    customerProfileId,
    customerPaymentProfileId,
    currentPeriodEnd,
  } = args;

  // Step 1: Cancel current annual ARB
  try {
    await cancelARBSubscription(oldSubscriptionId);
  } catch (err) {
    console.error("[switch-plan] cancel annual failed:", err);
    return NextResponse.json(
      { error: "Failed to cancel current annual subscription" },
      { status: 400 }
    );
  }

  // Step 2: Create new monthly ARB with startDate = currentPeriodEnd
  let newArbId: string;
  try {
    const arb = await createARBSubscription({
      billingInterval: "monthly",
      customerProfileId,
      customerPaymentProfileId,
      nextBillingDate: currentPeriodEnd,
    });
    newArbId = arb.subscriptionId;
  } catch (err) {
    console.error("[switch-plan] failed to create dormant monthly ARB:", err);
    return NextResponse.json(
      {
        error:
          "Failed to schedule monthly plan. Your annual plan is still canceled — contact support.",
      },
      { status: 500 }
    );
  }

  // Step 3: Update InsForge — billing_interval stays 'annual' until expiry
  const now = new Date();
  const { error: updateError } = await client.database
    .from("subscriptions")
    .update({
      // Stay on annual until the period actually ends
      billing_interval: "annual",
      // But point anet_subscription_id at the NEW dormant monthly sub so
      // webhooks/reconcile operate on the right subscription going forward.
      anet_subscription_id: newArbId,
      pending_switch_to: "monthly",
      pending_switch_sub_id: newArbId,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("[switch-plan] DB update failed:", updateError);
  }

  return NextResponse.json({
    success: true,
    switched: "annual→monthly (scheduled)",
    effectiveDate: currentPeriodEnd.toISOString(),
    pendingSubscriptionId: newArbId,
  });
}
