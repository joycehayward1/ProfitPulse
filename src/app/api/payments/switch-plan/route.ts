import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-auth";
import { switchPlan } from "@/lib/plan-switch";
import type { BillingInterval } from "@/components/payments/PricingCards";

/**
 * POST /api/payments/switch-plan
 * Body: { target: "monthly" | "annual" }
 *
 * The signed-in subscriber switches their own plan. The logic (charges,
 * proration, ARB changes) lives in lib/plan-switch so admins use the same flow.
 */
export async function POST(request: NextRequest) {
  let body: { target?: BillingInterval };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Act only on the signed-in caller's own subscription, never a body userId.
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (body.target !== "monthly" && body.target !== "annual") {
    return NextResponse.json(
      { error: "target must be 'monthly' or 'annual'" },
      { status: 400 }
    );
  }

  return switchPlan(userId, body.target);
}
