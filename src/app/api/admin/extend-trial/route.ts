import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { getAccessSummary } from "@/lib/feature-gate";
import type { Subscription } from "@/lib/database.types";

const MAX_DAYS = 365;

/**
 * POST /api/admin/extend-trial
 * Body: { userId: string, days?: number }  (default 7, max 365)
 *
 * Extends a user's trial by `days`, counted from the current trial end if it
 * is still running, otherwise from now. Refuses users who already have full
 * access (paid, granted, comped) so a paying customer is never flipped back
 * to "trial".
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: string; days?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  const days = body.days ?? 7;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json(
      { error: `days must be a whole number between 1 and ${MAX_DAYS}` },
      { status: 400 }
    );
  }

  const client = getInsForgeAdmin();

  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing && getAccessSummary(existing as Subscription).level === "full") {
    return NextResponse.json(
      {
        error:
          "This user already has full access (paid, granted, or comped). Use Comp to add free time instead.",
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const currentEnd = existing?.trial_end_date ? new Date(existing.trial_end_date) : null;
  const newTrialEnd = new Date(currentEnd && currentEnd > now ? currentEnd : now);
  newTrialEnd.setDate(newTrialEnd.getDate() + days);

  const trialData = {
    subscription_status: "trial",
    trial_start_date: existing?.trial_start_date || now.toISOString(),
    trial_end_date: newTrialEnd.toISOString(),
  };

  const { error } = existing
    ? await client.database.from("subscriptions").update(trialData).eq("user_id", userId)
    : await client.database
        .from("subscriptions")
        .insert([{ user_id: userId, plan: "none", ...trialData }]);

  if (error) {
    console.error("[admin/extend-trial] write failed", { userId, error });
    return NextResponse.json({ error: "Failed to extend trial" }, { status: 500 });
  }

  await logAdminAction(admin, "extend_trial", { userId }, {
    days,
    previous_trial_end: existing?.trial_end_date ?? null,
    new_trial_end: newTrialEnd.toISOString(),
  });

  return NextResponse.json({ success: true, trial_end_date: newTrialEnd.toISOString() });
}
