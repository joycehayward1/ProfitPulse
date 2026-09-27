import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { owesMissedRenewal, settleMissedRenewal } from "@/lib/missed-renewal";
import type { Subscription } from "@/lib/database.types";

/**
 * POST /api/payments/retry-payment
 *
 * "Try my card again" after a declined renewal: charges the missed period to
 * the card already on file. On success the subscriber is active again through
 * their next billing date.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await getInsForgeAdmin()
    .database.from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const sub = data as Subscription | null;

  if (!sub || !owesMissedRenewal(sub)) {
    return NextResponse.json({ error: "There's no missed payment on your account." }, { status: 409 });
  }
  if (!sub.anet_payment_profile_id) {
    return NextResponse.json(
      { error: "There's no card on file. Add a card to pay." },
      { status: 400 }
    );
  }

  try {
    const result = await settleMissedRenewal(sub, sub.anet_payment_profile_id, user.email);

    if (result.status === "paid") {
      return NextResponse.json({ success: true, ...result });
    }
    if (result.status === "declined") {
      return NextResponse.json(
        {
          error: `Your card was declined again (${result.reason}). Try a different card.`,
          status: "declined",
        },
        { status: 402 }
      );
    }
    if (result.status === "left_to_authorize_net") {
      return NextResponse.json(
        {
          error:
            "Your subscription is paused by our payment processor. Update your card and the payment will be retried automatically.",
          status: result.status,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "There's no missed payment on your account." }, { status: 409 });
  } catch (err) {
    console.error("[retry-payment] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment failed. Please try again." },
      { status: 502 }
    );
  }
}
