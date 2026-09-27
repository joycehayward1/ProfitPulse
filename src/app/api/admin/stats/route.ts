import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql } from "@/lib/admin-log";
import { getAccessSummary } from "@/lib/feature-gate";
import { getDisplayMonthlyRate, type PricingPromo } from "@/lib/plan-amounts";
import type { Subscription } from "@/lib/database.types";

/**
 * GET /api/admin/stats
 *
 * Dashboard statistics. Counts come from auth.users (every account, whether
 * or not it has a profile row). Access counts use the same rules as the
 * in-app feature gate. "Paying" means an Authorize.net subscription with a
 * current paid period — admin grants and comps have access but are never
 * counted in MRR.
 *
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const authUsers = await adminSql<{ id: string; created_at: string }>(
    `SELECT id, created_at FROM auth.users
     WHERE email NOT LIKE '%@deleted.invalid' AND COALESCE(is_anonymous, false) = false
       AND COALESCE(is_project_admin, false) = false`
  );
  if (!authUsers) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const userIds = new Set(authUsers.map((u) => u.id));
  const totalUsers = userIds.size;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newSignups7d = authUsers.filter((u) => new Date(u.created_at) >= sevenDaysAgo).length;

  const client = getInsForgeAdmin();
  const { data: subscriptions } = await client.database.from("subscriptions").select("*");

  let withAccess = 0;
  let activeSubscribers = 0;
  let freeAccess = 0;
  let trialUsers = 0;
  let pastDue = 0;
  let mrr = 0;

  for (const row of subscriptions ?? []) {
    const sub = row as Subscription;
    if (!userIds.has(sub.user_id)) continue;

    const access = getAccessSummary(sub);
    if (access.level !== "locked") withAccess++;
    if (access.level === "trial") trialUsers++;
    if (sub.subscription_status === "past_due") pastDue++;

    // MRR: a live ARB whose paid period is current (lapsed renewals don't count).
    if (access.reason === "paid") {
      const promo: PricingPromo = sub.pricing_promo === "launch" ? "launch" : "standard";
      mrr += getDisplayMonthlyRate(sub.billing_interval === "annual" ? "annual" : "monthly", promo);
    }
    // Headline: anyone using paid-for time (incl. canceled with time left, and
    // failed-payment grace) is "paying"; granted/comped access is "free".
    if (access.reason === "paid" || access.reason === "grace" || access.reason === "canceled_in_period") {
      activeSubscribers++;
    } else if (access.level === "full") {
      freeAccess++;
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payments } = await client.database
    .from("payment_records")
    .select("amount, status")
    .gte("created_at", monthStart);

  let grossReceiptsMTD = 0;
  let failedPaymentsMTD = 0;
  for (const p of payments ?? []) {
    if (p.status === "success") {
      grossReceiptsMTD += parseFloat(p.amount) || 0;
    } else if (p.status === "failed") {
      failedPaymentsMTD++;
    }
  }

  return NextResponse.json({
    totalUsers,
    withAccess,
    activeSubscribers,
    freeAccess,
    trialUsers,
    pastDue,
    newSignups7d,
    grossReceiptsMTD,
    failedPaymentsMTD,
    mrr: Math.round(mrr * 100) / 100,
  });
}
