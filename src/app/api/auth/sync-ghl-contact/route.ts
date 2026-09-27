import { NextRequest, NextResponse } from "next/server";
import { syncSignupContactToGhl } from "@/lib/ghl";

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
 */
async function isRecentSignup(email: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) return false;
  try {
    const res = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT 1 FROM auth.users
                WHERE lower(email) = lower($1) AND created_at > NOW() - INTERVAL '15 minutes'`,
        params: [email],
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const rows = (data?.rows || data || []) as unknown[];
    return rows.length > 0;
  } catch {
    return false;
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

  if (!(await isRecentSignup(email))) {
    return NextResponse.json({ error: "Unknown signup" }, { status: 403 });
  }

  const error = await syncSignupContactToGhl({ email, fullName });

  if (error) {
    return NextResponse.json({ synced: false, error }, { status: 502 });
  }

  return NextResponse.json({ synced: true });
}
