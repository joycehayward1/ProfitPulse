import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import {
  createCustomerPaymentProfile,
  updateARBSubscription,
} from "@/lib/authorize-net";

/**
 * POST /api/payments/update-card
 *
 * Flow 8 from PAYMENTS_PLAN.md — Update Payment Method.
 *
 * Body: {
 *   userId: string,
 *   nonce: { dataDescriptor, dataValue },
 *   customer?: { firstName, lastName, zip }
 * }
 *
 * Steps:
 *   1. Create a new payment profile under the user's existing Customer Profile
 *   2. Update the active ARB to use the new payment profile
 *   3. Update InsForge:
 *      - anet_payment_profile_id: new ID
 *      - If user was past_due, flip status back to active (card is good now)
 *
 * Requires the user to already have an existing customer_profile_id and
 * (ideally) an active ARB. For users without an ARB, they should use the
 * /api/payments/subscribe route instead.
 */
export async function POST(request: NextRequest) {
  let body: {
    userId?: string;
    nonce?: { dataDescriptor: string; dataValue: string };
    customer?: { firstName?: string; lastName?: string; zip?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!body.nonce?.dataDescriptor || !body.nonce?.dataValue) {
    return NextResponse.json(
      { error: "Payment nonce is missing or malformed" },
      { status: 400 }
    );
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

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

  if (!sub.anet_customer_profile_id) {
    return NextResponse.json(
      {
        error:
          "No existing card on file. Use /api/payments/subscribe to start a new subscription.",
      },
      { status: 400 }
    );
  }

  try {
    // Step 1: Create a new payment profile under the existing customer
    const newProfile = await createCustomerPaymentProfile({
      customerProfileId: sub.anet_customer_profile_id,
      nonce: body.nonce,
      billTo: body.customer,
    });

    // Step 2: Update the ARB (if one exists) to point at the new profile
    if (sub.anet_subscription_id) {
      try {
        await updateARBSubscription({
          subscriptionId: sub.anet_subscription_id,
          customerProfileId: sub.anet_customer_profile_id,
          customerPaymentProfileId: newProfile.customerPaymentProfileId,
        });
      } catch (err) {
        console.error("[update-card] ARB update failed:", err);
        return NextResponse.json(
          {
            error:
              "Card added but we couldn't update your subscription billing info. Contact support.",
            customerPaymentProfileId: newProfile.customerPaymentProfileId,
          },
          { status: 500 }
        );
      }
    }

    // Step 3: Update InsForge — new payment profile, reset past_due if needed
    const updatePayload: Record<string, unknown> = {
      anet_payment_profile_id: newProfile.customerPaymentProfileId,
      updated_at: new Date().toISOString(),
    };
    if (sub.subscription_status === "past_due") {
      updatePayload.subscription_status = "active";
      updatePayload.last_payment_status = null;
    }

    const { error: updateError } = await client.database
      .from("subscriptions")
      .update(updatePayload)
      .eq("user_id", body.userId);

    if (updateError) {
      console.error("[update-card] DB update failed:", updateError);
    }

    return NextResponse.json({
      success: true,
      customerPaymentProfileId: newProfile.customerPaymentProfileId,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Card update failed";
    console.error("[update-card] error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
