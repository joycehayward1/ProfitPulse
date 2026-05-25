import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * POST /api/admin/grant-pro
 * Body: { userId: string, email: string }
 *
 * Grants a user an active monthly Pro subscription.
 * Admin-only — checks ADMIN_EMAILS.
 */
export async function POST(request: NextRequest) {
  let body: { userId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, email } = body;

  if (!userId || !email) {
    return NextResponse.json(
      { error: "userId and email required" },
      { status: 400 }
    );
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(email.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscriptionData = {
    user_id: userId,
    plan: "pro",
    subscription_status: "active",
    billing_interval: "monthly",
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
