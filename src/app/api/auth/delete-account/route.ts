import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";

/**
 * POST /api/auth/delete-account
 *
 * Deletes the authenticated user's data and tombstones their auth record.
 *
 * Auth: caller must present a valid Bearer access token whose user.id
 * matches the userId in the request body.
 *
 * Why "tombstone" instead of DELETE on auth.users:
 * InsForge blocks DELETE on the auth schema at the platform level.
 * UPDATE is allowed. We rename the email to a non-routable value,
 * null the password, and wipe profile/metadata. Net effect: no PII
 * remains, no login is possible, original email is freed.
 *
 * payment_records is intentionally NOT deleted — billing records are
 * retained per the Privacy Policy (up to 7 years for financial regs).
 */
export async function POST(request: NextRequest) {
  const authedUser = await getAuthenticatedUser(request);
  if (!authedUser) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  if (userId !== authedUser.id) {
    return NextResponse.json(
      { error: "You can only delete your own account" },
      { status: 403 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Public-schema tables to delete. payment_records is omitted on purpose
  // (retained for billing/audit per Privacy Policy § 6).
  const publicTables = [
    "financial_snapshots",
    "health_assessments",
    "subscriptions",
    "notification_preferences",
    "quickbooks_connections",
    "profiles",
  ];

  for (const table of publicTables) {
    const res = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `DELETE FROM public.${table} WHERE user_id = $1`,
        params: [userId],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`Delete ${table} failed:`, res.status, detail);
      return NextResponse.json(
        { error: `Failed to delete ${table}` },
        { status: 500 }
      );
    }
  }

  // Tombstone the OAuth provider links (DELETE on auth schema is blocked,
  // UPDATE is allowed). Renames the external account id so OAuth callbacks
  // can no longer link back to this row.
  const tombstoneProviders = await fetch(
    `${baseUrl}/api/database/advance/rawsql/unrestricted`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `UPDATE auth.user_providers
                SET provider_account_id = 'deleted-' || gen_random_uuid()::text,
                    access_token = NULL
                WHERE user_id = $1`,
        params: [userId],
      }),
    }
  );

  if (!tombstoneProviders.ok) {
    const detail = await tombstoneProviders.text().catch(() => "");
    console.error("Tombstone user_providers failed:", tombstoneProviders.status, detail);
    // Non-fatal: providers row staying linked but with stale token is acceptable
    // because the auth.users tombstone (next step) makes the account unusable.
  }

  // Tombstone the auth.users row: rename email, null password, wipe profile.
  const tombstoneUser = await fetch(
    `${baseUrl}/api/database/advance/rawsql/unrestricted`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `UPDATE auth.users
                SET email = 'deleted-' || gen_random_uuid()::text || '@deleted.invalid',
                    password = NULL,
                    email_verified = false,
                    profile = '{}'::jsonb,
                    metadata = jsonb_build_object('deleted_at', NOW()::text),
                    updated_at = NOW()
                WHERE id = $1`,
        params: [userId],
      }),
    }
  );

  if (!tombstoneUser.ok) {
    const detail = await tombstoneUser.text().catch(() => "");
    console.error("Tombstone auth.users failed:", tombstoneUser.status, detail);
    return NextResponse.json(
      {
        error:
          "Your data was deleted but we could not fully remove your login. Please contact support to complete the removal.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
