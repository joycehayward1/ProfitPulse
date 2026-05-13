import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

const MONTHLY_PRICE = 59.99;
const ANNUAL_PRICE = 599.88;

/**
 * GET /api/admin/stats
 *
 * Returns dashboard statistics: total users, active subscribers,
 * trial users, gross receipts MTD, and calculated MRR.
 *
 * Subscriptions without a matching profile (orphan rows) are excluded
 * from user-counting metrics.
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

  const { data: profiles } = await client.database
    .from("profiles")
    .select("user_id");

  const profileIds = new Set<string>(
    (profiles || []).map((p: { user_id: string }) => p.user_id)
  );
  const totalUsers = profileIds.size;

  const { data: subscriptions } = await client.database
    .from("subscriptions")
    .select("user_id, subscription_status, billing_interval");

  let activeSubscribers = 0;
  let trialUsers = 0;
  let mrr = 0;

  if (subscriptions) {
    for (const sub of subscriptions) {
      if (!profileIds.has(sub.user_id)) continue;

      if (sub.subscription_status === "active") {
        activeSubscribers++;
        if (sub.billing_interval === "annual") {
          mrr += ANNUAL_PRICE / 12;
        } else {
          mrr += MONTHLY_PRICE;
        }
      } else if (sub.subscription_status === "trial") {
        trialUsers++;
      }
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: payments } = await client.database
    .from("payment_records")
    .select("amount, status")
    .gte("created_at", monthStart)
    .eq("status", "success");

  let grossReceiptsMTD = 0;
  if (payments) {
    for (const p of payments) {
      grossReceiptsMTD += parseFloat(p.amount) || 0;
    }
  }

  return NextResponse.json({
    totalUsers,
    activeSubscribers,
    trialUsers,
    grossReceiptsMTD,
    mrr,
    // Kept for backwards compatibility with any older client cache
    monthlyRevenue: grossReceiptsMTD,
  });
}
