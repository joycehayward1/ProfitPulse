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
 */
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

  const error = await syncSignupContactToGhl({ email, fullName });

  if (error) {
    return NextResponse.json({ synced: false, error }, { status: 502 });
  }

  return NextResponse.json({ synced: true });
}
