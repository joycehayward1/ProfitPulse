import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/admin/stats
 *
 * Returns dashboard statistics: total users, active subscribers,
 * trial users, and monthly revenue.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
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

  // Total users (profile count)
  const { data: profiles } = await client.database
    .from("profiles")
    .select("user_id");

  const totalUsers = profiles?.length ?? 0;

  // Subscriptions breakdown
  const { data: subscriptions } = await client.database
    .from("subscriptions")
    .select("subscription_status, billing_interval");

  let activeSubscribers = 0;
  let trialUsers = 0;

  if (subscriptions) {
    for (const sub of subscriptions) {
      if (sub.subscription_status === "active") activeSubscribers++;
      if (sub.subscription_status === "trial") trialUsers++;
    }
  }

  // Monthly revenue — sum of successful payments this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payments } = await client.database
    .from("payment_records")
    .select("amount, status")
    .gte("created_at", monthStart)
    .eq("status", "success");

  let monthlyRevenue = 0;
  if (payments) {
    for (const p of payments) {
      monthlyRevenue += parseFloat(p.amount) || 0;
    }
  }

  return NextResponse.json({
    totalUsers,
    activeSubscribers,
    trialUsers,
    monthlyRevenue,
  });
}
