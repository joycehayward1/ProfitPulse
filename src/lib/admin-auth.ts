import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Resolve the authenticated user from the Bearer token and verify their
 * email is in ADMIN_EMAILS (comma-separated env var).
 * Returns the admin user, or null when unauthenticated / not an admin.
 *
 * Never trust client-supplied emails for admin checks — only the email
 * attached to a verified session token counts.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminUser | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return null;
  }

  return user;
}
