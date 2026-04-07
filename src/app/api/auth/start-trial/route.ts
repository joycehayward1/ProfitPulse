import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

const TRIAL_DAYS = 7;

/**
 * POST /api/auth/start-trial
 * Body: { userId: string }
 *
 * Called immediately after a user signs up. Creates their `subscriptions`
 * row with trial fields set:
 *   plan: 'none'
 *   subscription_status: 'trial'
 *   trial_start_date: now
 *   trial_end_date: now + 7 days
 *
 * Idempotent — if a row already exists for the user, returns it unchanged.
 *
 * Note: takes userId from body rather than auth header because the InsForge
 * client session isn't always cached yet immediately after signUp().
 */
export async function POST(request: NextRequest) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Idempotent: if a row already exists, return it
  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ subscription: existing, created: false });
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const { data, error } = await client.database
    .from("subscriptions")
    .insert({
      user_id: userId,
      plan: "none",
      subscription_status: "trial",
      trial_start_date: now.toISOString(),
      trial_end_date: trialEnd.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[start-trial] insert failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create trial" },
      { status: 500 }
    );
  }

  return NextResponse.json({ subscription: data, created: true });
}
