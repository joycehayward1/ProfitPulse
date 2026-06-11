import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/check
 *
 * Returns { isAdmin: true/false } for the authenticated user.
 * Identity comes from the Bearer access token — never from query params.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  return NextResponse.json({ isAdmin: admin !== null });
}
