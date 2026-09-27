import { getInsForgeAdmin } from "@/lib/insforge";
import type { AdminUser } from "@/lib/admin-auth";

/**
 * Run SQL with the server-only admin key. Needed for auth.users, which the
 * SDK doesn't expose. Returns null on failure.
 */
export async function adminSql<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  try {
    const res = await fetch(`${baseUrl}/api/database/advance/rawsql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, params }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.rows || data || []) as T[];
  } catch {
    return null;
  }
}

export type AdminActionType =
  | "grant_pro"
  | "extend_trial"
  | "comp_days"
  | "comped_email_add"
  | "comped_email_remove"
  | "send_password_reset"
  | "resend_verification";

/**
 * Record an admin action in the audit log. Never throws — a logging failure
 * must not undo or block the action itself.
 */
export async function logAdminAction(
  admin: AdminUser,
  action: AdminActionType,
  target: { userId?: string | null; email?: string | null },
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await getInsForgeAdmin()
      .database.from("admin_actions")
      .insert([
        {
          admin_email: admin.email,
          action,
          target_user_id: target.userId ?? null,
          target_email: target.email ?? null,
          details,
        },
      ]);
    if (error) console.error("[admin-log] insert failed", { action, error });
  } catch (err) {
    console.error("[admin-log] insert failed", { action, err });
  }
}
