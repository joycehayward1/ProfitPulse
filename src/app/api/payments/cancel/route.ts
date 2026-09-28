import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-auth";
import { cancelSubscription } from "@/lib/cancel-subscription";

/**
 * POST /api/payments/cancel
 *
 * The signed-in subscriber cancels their own recurring billing; they keep
 * access until current_period_end. Logic lives in lib/cancel-subscription.
 */
export async function POST(request: NextRequest) {
  // Act only on the signed-in caller's own subscription, never a body userId.
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return cancelSubscription(userId);
}
