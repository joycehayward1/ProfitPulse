import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

/**
 * POST /api/admin/extend-trial
 * Body: { userId: string, email: string }
 *
 * Extends a user's trial by 7 days from their current trial_end_date
 * (or from now if no trial exists).
 * Admin-only — checks ADMIN_EMAILS.
 */
export async function POST(request: NextRequest) {
  let body: { userId?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, email } = body;

  if (!userId || !email) {
    return NextResponse.json(
      { error: "userId and email required" },
      { status: 400 }
    );
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

  // Get existing subscription
  const { data: existing } = await client.database
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  let newTrialEnd: Date;

  if (existing?.trial_end_date) {
    // Extend from current trial end
    const currentEnd = new Date(existing.trial_end_date);
    // If trial already expired, extend from now
    newTrialEnd = currentEnd > now ? currentEnd : now;
    newTrialEnd.setDate(newTrialEnd.getDate() + 7);
  } else {
    // No trial exists, start one from now
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + 7);
  }

  const trialData = {
    subscription_status: "trial",
    trial_start_date: existing?.trial_start_date || now.toISOString(),
    trial_end_date: newTrialEnd.toISOString(),
  };

  if (existing) {
    const { error } = await client.database
      .from("subscriptions")
      .update(trialData)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to extend trial" },
        { status: 500 }
      );
    }
  } else {
    const { error } = await client.database
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan: "none",
        ...trialData,
      });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create trial" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    trial_end_date: newTrialEnd.toISOString(),
  });
}
