import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { requireAdmin } from "@/lib/admin-auth";

export type GrantDuration = "1m" | "12m" | "lifetime";

/**
 * POST /api/admin/grant-pro
 * Body: { userId: string, duration?: "1m" | "12m" | "lifetime" }
 *
 * Grants a user an active Pro subscription for the chosen duration
 * (default 1 month). Lifetime is stored as a period end 100 years out.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: string; duration?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  const duration = (body.duration || "1m") as GrantDuration;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (!["1m", "12m", "lifetime"].includes(duration)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Check if subscription row exists
  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const periodEnd = new Date(now);
  let billingInterval: string | null;

  if (duration === "lifetime") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);
    billingInterval = null;
  } else if (duration === "12m") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    billingInterval = "annual";
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    billingInterval = "monthly";
  }

  const subscriptionData = {
    user_id: userId,
    plan: "pro",
    subscription_status: "active",
    billing_interval: billingInterval,
    billing_cycle_start_date: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_end_date: null,
  };

  if (existing) {
    const { error } = await client.database
      .from("subscriptions")
      .update(subscriptionData)
      .eq("user_id", userId);

    if (error) {
      console.error("[admin/grant-pro] update failed", { userId, error });
      return NextResponse.json(
        { error: "Failed to update subscription" },
        { status: 500 }
      );
    }
  } else {
    const { error } = await client.database
      .from("subscriptions")
      .insert(subscriptionData);

    if (error) {
      console.error("[admin/grant-pro] insert failed", { userId, error });
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
