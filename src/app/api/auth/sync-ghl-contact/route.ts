import { NextRequest, NextResponse } from "next/server";
import { syncSignupContactToGhl } from "@/lib/ghl";
import { getSignupTrialEndDate } from "@/lib/ghl-events";
import { getInsForgeAdmin } from "@/lib/insforge";

/**
 * POST /api/auth/sync-ghl-contact
 * Body: { email: string, fullName: string }
 *
 * Sends new signup name + email to the Go High Level inbound webhook so
 * the CRM workflow can create/update the contact and apply tags.
 *
 * Non-blocking for signup — failures are logged but do not block the user.
 *
 * Runs before email verification, so there is no session to check. Instead
 * the email must belong to an account created in the last 15 minutes, which
 * keeps the endpoint from being used to push arbitrary leads into the CRM.
 *
 * Sent once per account: each delivery re-enters the contact into the GHL
 * sign-up workflow (and its welcome email), so a repeat call is claimed in
 * email_log and skipped. A failed delivery releases the claim so it can retry.
 */
const SIGNUP_CLAIM_KIND = "ghl_signup";
const SIGNUP_CLAIM_REF = "signup";

async function findRecentSignup(email: string): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  try {
    const res = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT id FROM auth.users
                WHERE lower(email) = lower($1) AND created_at > NOW() - INTERVAL '15 minutes'`,
        params: [email],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = (data?.rows || data || []) as { id?: string }[];
    return typeof rows[0]?.id === "string" ? rows[0].id : null;
  } catch {
    return null;
  }
}

/** True if this call claimed the sign-up event; false if it was already sent or is in flight. */
async function claimSignupSync(userId: string): Promise<boolean> {
  try {
    const { error } = await getInsForgeAdmin()
      .database.from("email_log")
      .insert([{ user_id: userId, kind: SIGNUP_CLAIM_KIND, ref: SIGNUP_CLAIM_REF }]);
    return !error;
  } catch {
    return false;
  }
}

async function releaseSignupSync(userId: string): Promise<void> {
  try {
    await getInsForgeAdmin()
      .database.from("email_log")
      .delete()
      .eq("user_id", userId)
      .eq("kind", SIGNUP_CLAIM_KIND)
      .eq("ref", SIGNUP_CLAIM_REF);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    console.error(`[ghl] could not release sign-up claim (${reason})`);
  }
}

export async function POST(request: NextRequest) {
  let body: { email?: string; fullName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = body.email?.trim();
  const fullName = body.fullName?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!fullName) {
    return NextResponse.json({ error: "fullName required" }, { status: 400 });
  }

  const userId = await findRecentSignup(email);
  if (!userId) {
    return NextResponse.json({ error: "Unknown signup" }, { status: 403 });
  }

  if (!process.env.GHL_SIGNUP_WEBHOOK_URL?.trim()) {
    console.warn("[ghl] GHL_SIGNUP_WEBHOOK_URL is not configured — skipping sync");
    return NextResponse.json({ synced: false, skipped: "not_configured" });
  }

  if (!(await claimSignupSync(userId))) {
    return NextResponse.json({ synced: false, skipped: "already_sent" });
  }

  const trialEndDate = await getSignupTrialEndDate(email);
  const error = await syncSignupContactToGhl({ email, fullName, trialEndDate });

  if (error) {
    await releaseSignupSync(userId);
    return NextResponse.json({ synced: false, error }, { status: 502 });
  }

  return NextResponse.json({ synced: true });
}
