import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql, logAdminAction } from "@/lib/admin-log";

type SupportAction = "password_reset" | "resend_verification";

/**
 * POST /api/admin/support
 * Body: { userId: string, action: "password_reset" | "resend_verification" }
 *
 * Sends the user a password-reset email or a fresh email-verification code,
 * the same emails they would get by asking for one themselves.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action as SupportAction;
  if (!body.userId || !["password_reset", "resend_verification"].includes(action)) {
    return NextResponse.json({ error: "userId and a valid action required" }, { status: 400 });
  }

  const rows = await adminSql<{ email: string; email_verified: boolean }>(
    "SELECT email, email_verified FROM auth.users WHERE id = $1",
    [body.userId]
  );
  const target = rows?.[0];
  if (!target || target.email.endsWith("@deleted.invalid")) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (action === "resend_verification" && target.email_verified) {
    return NextResponse.json({ error: "This user's email is already verified" }, { status: 409 });
  }

  const auth = getInsForgeAdmin().auth;
  const { error } =
    action === "password_reset"
      ? await auth.sendResetPasswordEmail({ email: target.email })
      : await auth.resendVerificationEmail({ email: target.email });

  if (error) {
    console.error(`[admin/support] ${action} failed`, { userId: body.userId, error });
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 502 });
  }

  await logAdminAction(
    admin,
    action === "password_reset" ? "send_password_reset" : "resend_verification",
    { userId: body.userId, email: target.email }
  );

  return NextResponse.json({ success: true, email: target.email });
}
