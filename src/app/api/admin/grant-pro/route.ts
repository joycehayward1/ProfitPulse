import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { getARBSubscription } from "@/lib/authorize-net";

export type GrantDuration = "1m" | "3m" | "6m" | "12m" | "lifetime" | "custom";

const MONTHS: Record<Exclude<GrantDuration, "lifetime" | "custom">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

/**
 * POST /api/admin/grant-pro
 * Body: { userId: string, duration?: GrantDuration, endDate?: "YYYY-MM-DD" }
 *
 * Grants a user an active Pro subscription for the chosen duration (default
 * 1 month). "custom" requires a future endDate. Lifetime is stored as a period
 * end 100 years out. Never charges a card.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: string; duration?: string; endDate?: string };
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
  if (!["1m", "3m", "6m", "12m", "lifetime", "custom"].includes(duration)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  const now = new Date();
  let periodEnd = new Date(now);

  if (duration === "lifetime") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);
  } else if (duration === "custom") {
    const match = body.endDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return NextResponse.json({ error: "Pick the last day of access." }, { status: 400 });
    }
    // End of the chosen day in Bermuda (AST, UTC-4).
    periodEnd = new Date(`${body.endDate}T23:59:59-04:00`);
    const [, y, m, d] = match.map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (
      Number.isNaN(periodEnd.getTime()) ||
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() !== m - 1 ||
      check.getUTCDate() !== d
    ) {
      return NextResponse.json({ error: "That date doesn't exist. Pick another." }, { status: 400 });
    }
    if (periodEnd <= now) {
      return NextResponse.json({ error: "Pick a date in the future." }, { status: 400 });
    }
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + MONTHS[duration]);
  }

  const client = getInsForgeAdmin();

  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Granting detaches the Authorize.net subscription. If it's still billing,
  // their card would keep being charged with nothing recorded — refuse.
  if (existing?.anet_subscription_id) {
    let liveStatus: string | null = null;
    try {
      liveStatus = (await getARBSubscription(existing.anet_subscription_id)).status.toLowerCase();
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't check their subscription with Authorize.net, so free Pro wasn't given. Try again in a minute.",
        },
        { status: 502 }
      );
    }
    if (liveStatus === "active" || liveStatus === "suspended") {
      return NextResponse.json(
        {
          error:
            "They still have a subscription that charges their card. Use Add free days instead, or cancel their subscription in Authorize.net first.",
        },
        { status: 409 }
      );
    }
  }

  const subscriptionData = {
    user_id: userId,
    plan: "pro",
    subscription_status: "active",
    // Not billed; the interval only drives plan labels in Settings/Billing.
    billing_interval:
      duration === "lifetime" || duration === "custom" ? null : duration === "12m" ? "annual" : "monthly",
    billing_cycle_start_date: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    next_billing_date: null,
    trial_end_date: null,
    // Granted access is not billed — detach any old ARB pointer so the
    // reconcile cron doesn't mirror a cancelled ARB back onto this row.
    anet_subscription_id: null,
  };

  const { error } = existing
    ? await client.database.from("subscriptions").update(subscriptionData).eq("user_id", userId)
    : await client.database.from("subscriptions").insert([subscriptionData]);

  if (error) {
    console.error("[admin/grant-pro] write failed", { userId, error });
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }

  await logAdminAction(admin, "grant_pro", { userId }, {
    duration,
    access_until: periodEnd.toISOString(),
    previous_status: existing?.subscription_status ?? null,
    previous_period_end: existing?.current_period_end ?? null,
    detached_arb: existing?.anet_subscription_id ?? null,
  });

  return NextResponse.json({ success: true, current_period_end: periodEnd.toISOString() });
}
