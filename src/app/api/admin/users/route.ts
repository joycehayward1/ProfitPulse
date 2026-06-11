import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/users
 *
 * Returns all users with their profile, subscription, and auth email.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

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

  const [{ data: subscriptions }, { data: healthScores }, { data: financialPeriods }] =
    await Promise.all([
      client.database.from("subscriptions").select("*"),
      client.database.from("health_assessments").select("user_id, overall_score"),
      client.database.from("financial_data").select("user_id"),
    ]);

  // Fetch emails from auth.users via raw SQL endpoint (profiles table has no
  // email column; InsForge SDK doesn't expose auth.users directly).
  const emailMap = new Map<string, string>();
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (baseUrl && apiKey && profiles && profiles.length > 0) {
    const userIds = profiles.map((p: Record<string, unknown>) => p.user_id as string);
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(",");
    try {
      const res = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `SELECT id, email FROM auth.users WHERE id IN (${placeholders})`,
          params: userIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const rows = (data?.rows || data || []) as { id: string; email: string }[];
        for (const row of rows) {
          if (row.id && row.email) emailMap.set(row.id, row.email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch auth emails:", err);
    }
  }

  const subMap = new Map<string, Record<string, unknown>>();
  if (subscriptions) {
    for (const sub of subscriptions) {
      subMap.set(sub.user_id, sub);
    }
  }

  const healthMap = new Map<string, number>();
  if (healthScores) {
    for (const h of healthScores) {
      healthMap.set(h.user_id, h.overall_score);
    }
  }

  const periodMap = new Map<string, number>();
  if (financialPeriods) {
    for (const f of financialPeriods) {
      periodMap.set(f.user_id, (periodMap.get(f.user_id) || 0) + 1);
    }
  }

  const users = (profiles || []).map((profile: Record<string, unknown>) => {
    const userId = profile.user_id as string;
    const sub = subMap.get(userId) as Record<string, unknown> | undefined;

    return {
      id: userId,
      name: profile.name || "—",
      email: emailMap.get(userId) || "—",
      business_name: profile.business_name || null,
      avatar_url: profile.avatar_url || null,
      plan: sub?.subscription_status || "none",
      billing_interval: sub?.billing_interval || null,
      trial_end_date: sub?.trial_end_date || null,
      next_billing_date: sub?.next_billing_date || null,
      current_period_end: sub?.current_period_end || null,
      pricing_promo: sub?.pricing_promo || null,
      last_payment_date: sub?.last_payment_date || null,
      last_payment_amount: sub?.last_payment_amount || null,
      last_payment_status: sub?.last_payment_status || null,
      health_score: healthMap.get(userId) ?? null,
      data_periods: periodMap.get(userId) ?? 0,
      joined: profile.created_at || null,
    };
  });

  return NextResponse.json({ users });
}
