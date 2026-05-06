import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * GET /api/admin/users
 *
 * Returns all users with their profile and subscription data.
 * Admin-only — checks ADMIN_EMAILS env var against the email query param.
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

  // Fetch profiles
  const { data: profiles, error: profilesError } = await client.database
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }

  // Fetch all subscriptions
  const { data: subscriptions } = await client.database
    .from("subscriptions")
    .select("*");

  // Fetch health assessment scores
  const { data: healthScores } = await client.database
    .from("health_assessments")
    .select("user_id, overall_score");

  // Fetch financial data period counts
  const { data: financialPeriods } = await client.database
    .from("financial_data")
    .select("user_id");

  // Build a map of subscription by user_id
  const subMap = new Map<string, Record<string, unknown>>();
  if (subscriptions) {
    for (const sub of subscriptions) {
      subMap.set(sub.user_id, sub);
    }
  }

  // Build health score map
  const healthMap = new Map<string, number>();
  if (healthScores) {
    for (const h of healthScores) {
      healthMap.set(h.user_id, h.overall_score);
    }
  }

  // Build period count map
  const periodMap = new Map<string, number>();
  if (financialPeriods) {
    for (const f of financialPeriods) {
      periodMap.set(f.user_id, (periodMap.get(f.user_id) || 0) + 1);
    }
  }

  // Combine data
  const users = (profiles || []).map((profile: Record<string, unknown>) => {
    const userId = profile.user_id as string;
    const sub = subMap.get(userId) as Record<string, unknown> | undefined;

    return {
      id: userId,
      name: profile.name || "—",
      email: profile.email || "—",
      business_name: profile.business_name || null,
      avatar_url: profile.avatar_url || null,
      plan: sub?.subscription_status || "none",
      billing_interval: sub?.billing_interval || null,
      trial_end_date: sub?.trial_end_date || null,
      health_score: healthMap.get(userId) ?? null,
      data_periods: periodMap.get(userId) ?? 0,
      joined: profile.created_at || null,
    };
  });

  return NextResponse.json({ users });
}
