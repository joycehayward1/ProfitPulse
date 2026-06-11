import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/payments
 *
 * Returns the 50 most recent payment records with user emails attached.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  const { data: payments, error } = await client.database
    .from("payment_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }

  // Resolve user emails via raw SQL (auth.users is not exposed by the SDK)
  const emailMap = new Map<string, string>();
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  const userIds = Array.from(
    new Set((payments || []).map((p: { user_id: string }) => p.user_id))
  );

  if (baseUrl && apiKey && userIds.length > 0) {
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(",");
    try {
      const res = await fetch(`${baseUrl}/api/database/advance/rawsql/unrestricted`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `SELECT id, email FROM auth.users WHERE id IN (${placeholders})`,
          params: userIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const rows = (data?.rows || data || []) as { id: string; email: string }[];
        for (const row of rows) {
          if (row.id && row.email) emailMap.set(row.id, row.email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch auth emails:", err);
    }
  }

  const records = (payments || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    email: emailMap.get(p.user_id as string) || "—",
    type: p.type,
    amount: parseFloat(String(p.amount)) || 0,
    status: p.status,
    billing_interval: p.billing_interval,
    description: p.description,
    created_at: p.created_at,
  }));

  return NextResponse.json({ payments: records });
}
