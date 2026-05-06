import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/check?email=user@example.com
 *
 * Returns { isAdmin: true/false } based on whether the email
 * is in the ADMIN_EMAILS environment variable (comma-separated list).
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ isAdmin: false }, { status: 400 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isAdmin = adminEmails.includes(email.toLowerCase());

  return NextResponse.json({ isAdmin });
}
