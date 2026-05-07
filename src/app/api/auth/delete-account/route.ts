import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
    const apiKey = process.env.INSFORGE_API_KEY;

    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Delete user data from all public tables
    const tables = [
      "financial_snapshots",
      "health_assessments",
      "payment_records",
      "subscriptions",
      "notification_preferences",
      "quickbooks_connections",
      "profiles",
    ];

    for (const table of tables) {
      await fetch(`${baseUrl}/api/database/advance/rawsql`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `DELETE FROM public.${table} WHERE user_id = $1`,
          params: [userId],
        }),
      });
    }

    // Delete auth sessions
    await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "DELETE FROM auth.user_providers WHERE user_id = $1",
        params: [userId],
      }),
    });

    // Delete the user from auth.users
    await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: "DELETE FROM auth.users WHERE id = $1",
        params: [userId],
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
