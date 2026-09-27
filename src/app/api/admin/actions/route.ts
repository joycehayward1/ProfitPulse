import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/actions
 *
 * The 200 most recent admin actions (grants, trial extensions, comps,
 * comped-list changes, support emails), newest first.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await getInsForgeAdmin()
    .database.from("admin_actions")
    .select("id, admin_email, action, target_user_id, target_email, details, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }

  return NextResponse.json({ actions: data ?? [] });
}
