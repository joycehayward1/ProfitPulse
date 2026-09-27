import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

/**
 * POST /api/admin/comp-days
 * Body: { userId: string, days: number }
 *
 * Grants a goodwill credit: `days` is added to the user's comp_days, which
 * extends their access past current_period_end (see feature-gate.ts). Used
 * for make-goods (e.g. billing mistakes) without refunding or touching the
 * Authorize.net ARB subscription.
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

  const { userId, days } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    return NextResponse.json(
      { error: "days must be an integer between 1 and 365" },
      { status: 400 }
    );
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing || existing.subscription_status === "trial" || !existing.current_period_end) {
    return NextResponse.json(
      {
        error:
          "Free days are added after paid time, and they haven't paid yet. Use Extend their trial or Give free Pro instead.",
      },
      { status: 409 }
    );
  }

  // Comp days count from the end of paid time. If that (plus any earlier comp)
  // is already in the past, start the free days from today instead so they
  // actually restore access.
  const effectiveEnd = new Date(existing.current_period_end);
  effectiveEnd.setDate(effectiveEnd.getDate() + (existing.comp_days ?? 0));
  const expired = effectiveEnd <= new Date();

  const newCompDays = expired ? days : (existing.comp_days ?? 0) + days;
  const update: Record<string, unknown> = {
    comp_days: newCompDays,
    updated_at: new Date().toISOString(),
  };
  if (expired) update.current_period_end = new Date().toISOString();

  const { error } = await client.database
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to grant comp days" },
      { status: 500 }
    );
  }

  await logAdminAction(admin, "comp_days", { userId }, {
    days,
    total_comp_days: newCompDays,
    started_today: expired,
  });

  return NextResponse.json({ success: true, comp_days: newCompDays });
}
