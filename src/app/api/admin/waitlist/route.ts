import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { isAdminEmail } from "@/lib/admin";

/**
 * GET /api/admin/waitlist
 *
 * Returns every row in the waitlist table, ordered by most recent.
 * Gated by ADMIN_EMAILS env var — only allowlisted emails can read.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  const { data, error } = await client.database
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/waitlist] fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch waitlist" }, { status: 500 });
  }

  return NextResponse.json({
    count: data?.length ?? 0,
    rows: data ?? [],
  });
}
