import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql } from "@/lib/admin-log";
import { getAccessSummary } from "@/lib/feature-gate";
import type { Subscription } from "@/lib/database.types";

interface AuthUserRow {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
  auth_name: string | null;
}

/**
 * GET /api/admin/users
 *
 * Returns every account (from auth.users, so users without a profile row are
 * included) with profile, subscription, and a computed access summary that
 * uses the same rules as the in-app feature gate.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const authUsers = await adminSql<AuthUserRow>(
    `SELECT id, email, email_verified, created_at, profile->>'name' AS auth_name
     FROM auth.users
     WHERE email NOT LIKE '%@deleted.invalid' AND COALESCE(is_anonymous, false) = false
       AND COALESCE(is_project_admin, false) = false
     ORDER BY created_at DESC`
  );
  if (!authUsers) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const client = getInsForgeAdmin();
  const [{ data: profiles }, { data: subscriptions }, { data: assessments }, { data: snapshots }] =
    await Promise.all([
      client.database.from("profiles").select("user_id, name, business_name, avatar_url"),
      client.database.from("subscriptions").select("*"),
      client.database
        .from("health_assessments")
        .select("user_id, health_score, created_at")
        .order("created_at", { ascending: false }),
      client.database.from("financial_snapshots").select("user_id"),
    ]);

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of profiles ?? []) profileMap.set(String(p.user_id), p);

  const subMap = new Map<string, Subscription>();
  for (const s of subscriptions ?? []) subMap.set(String(s.user_id), s as Subscription);

  // Rows are newest-first, so the first one seen per user is their latest.
  const healthMap = new Map<string, number>();
  for (const h of assessments ?? []) {
    const id = String(h.user_id);
    if (!healthMap.has(id)) healthMap.set(id, h.health_score);
  }

  const periodMap = new Map<string, number>();
  for (const s of snapshots ?? []) {
    const id = String(s.user_id);
    periodMap.set(id, (periodMap.get(id) || 0) + 1);
  }

  const users = authUsers.map((u) => {
    const profile = profileMap.get(u.id);
    const sub = subMap.get(u.id) ?? null;

    return {
      id: u.id,
      name: (profile?.name as string) || u.auth_name || "—",
      email: u.email,
      email_verified: u.email_verified,
      business_name: (profile?.business_name as string) || null,
      avatar_url: (profile?.avatar_url as string) || null,
      plan: sub?.subscription_status || "none",
      billing_interval: sub?.billing_interval || null,
      trial_end_date: sub?.trial_end_date || null,
      next_billing_date: sub?.next_billing_date || null,
      current_period_end: sub?.current_period_end || null,
      pricing_promo: sub?.pricing_promo || null,
      comp_days: sub?.comp_days ?? 0,
      last_payment_date: sub?.last_payment_date || null,
      last_payment_amount: sub?.last_payment_amount ?? null,
      last_payment_status: sub?.last_payment_status || null,
      access: getAccessSummary(sub),
      health_score: healthMap.get(u.id) ?? null,
      data_periods: periodMap.get(u.id) ?? 0,
      joined: u.created_at,
    };
  });

  return NextResponse.json({ users });
}
