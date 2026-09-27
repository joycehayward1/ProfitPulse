import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql } from "@/lib/admin-log";
import { getAccessSummary } from "@/lib/feature-gate";
import { getARBSubscription } from "@/lib/authorize-net";
import type { Subscription } from "@/lib/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/users/:id
 *
 * Everything support needs about one account: login details, profile,
 * subscription with its computed access, the live Authorize.net subscription
 * status (if any), payment history, onboarding progress, and the admin
 * actions taken on the account.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userId = params.id;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const authRows = await adminSql<{
    id: string;
    email: string;
    email_verified: boolean;
    created_at: string;
    auth_name: string | null;
  }>(
    `SELECT id, email, email_verified, created_at, profile->>'name' AS auth_name
     FROM auth.users WHERE id = $1`,
    [userId]
  );
  const authUser = authRows?.[0];
  if (!authUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const client = getInsForgeAdmin();
  const [profileRes, subRes, paymentsRes, actionsRes, healthRes, selfRes, snapshotsRes] =
    await Promise.all([
      client.database.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      client.database.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      client.database
        .from("payment_records")
        .select("id, anet_transaction_id, type, amount, status, billing_interval, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      client.database
        .from("admin_actions")
        .select("id, admin_email, action, details, created_at")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      client.database
        .from("health_assessments")
        .select("health_score, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      client.database.from("self_assessments").select("created_at").eq("user_id", userId).maybeSingle(),
      client.database.from("financial_snapshots").select("period_date").eq("user_id", userId),
    ]);

  const subscription = (subRes.data as Subscription | null) ?? null;

  // Live status straight from Authorize.net — our DB can lag behind it.
  let arb: { id: string; status: string; lastChargeAt: string | null; error?: string } | null = null;
  if (subscription?.anet_subscription_id) {
    try {
      const live = await getARBSubscription(subscription.anet_subscription_id);
      arb = {
        id: live.subscriptionId,
        status: live.status,
        lastChargeAt: live.lastTransaction?.submitTimeUTC || null,
      };
    } catch (err) {
      arb = {
        id: subscription.anet_subscription_id,
        status: "unknown",
        lastChargeAt: null,
        error: err instanceof Error ? err.message : "Lookup failed",
      };
    }
  }

  const periods = ((snapshotsRes.data ?? []) as { period_date: string }[])
    .map((s) => s.period_date)
    .sort();
  const profile = profileRes.data as Record<string, unknown> | null;

  return NextResponse.json({
    user: {
      id: authUser.id,
      email: authUser.email,
      email_verified: authUser.email_verified,
      joined: authUser.created_at,
      name: (profile?.name as string) || authUser.auth_name || null,
      business_name: (profile?.business_name as string) || null,
      industry: (profile?.industry as string) || null,
    },
    subscription,
    access: getAccessSummary(subscription),
    arb,
    payments: paymentsRes.data ?? [],
    actions: actionsRes.data ?? [],
    onboarding: {
      self_assessment_at: (selfRes.data as { created_at: string } | null)?.created_at ?? null,
      health_score: (healthRes.data as { health_score: number }[] | null)?.[0]?.health_score ?? null,
      data_months: periods.length,
      first_month: periods[0] ?? null,
      latest_month: periods[periods.length - 1] ?? null,
    },
  });
}
