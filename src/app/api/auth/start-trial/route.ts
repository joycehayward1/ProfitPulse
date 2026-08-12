import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

const TRIAL_DAYS = 7;

async function rawSql(
  query: string,
  params: unknown[]
): Promise<Record<string, unknown>[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  try {
    const res = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, params }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.rows || data || []) as Record<string, unknown>[];
  } catch {
    return null;
  }
}

/**
 * If the user's signup email is on the comped_emails allowlist, returns the
 * matching allowlist email (lowercase). Fails open to a normal trial.
 */
async function findCompedEmail(userId: string): Promise<string | null> {
  const rows = await rawSql(
    `SELECT c.email FROM comped_emails c
     JOIN auth.users u ON lower(u.email) = c.email
     WHERE u.id = $1 AND c.claimed_at IS NULL`,
    [userId]
  );
  const email = rows?.[0]?.email;
  return typeof email === "string" ? email : null;
}

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
 * Exception: emails on the comped_emails allowlist skip the trial and get
 * lifetime Pro (admin-managed goodwill accounts, never billed).
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

  // Allowlisted emails skip the trial entirely and get lifetime Pro.
  const compedEmail = await findCompedEmail(userId);
  if (compedEmail) {
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    const { data, error } = await client.database
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "pro",
        subscription_status: "active",
        billing_interval: null,
        billing_cycle_start_date: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[start-trial] comped insert failed:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create subscription" },
        { status: 500 }
      );
    }

    await rawSql(
      "UPDATE comped_emails SET claimed_at = NOW(), claimed_by = $1 WHERE email = $2",
      [userId, compedEmail]
    );
    console.log(`[start-trial] comped signup: ${compedEmail} → lifetime Pro`);

    return NextResponse.json({ subscription: data, created: true, comped: true });
  }

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
