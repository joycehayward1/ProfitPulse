import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend";
import { buildWeeklySummaryEmail } from "@/lib/email-templates";
import { adminSql } from "@/lib/admin-log";
import { getUserAccessLevel } from "@/lib/feature-gate";
import type { Subscription } from "@/lib/database.types";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = request.headers.get("authorization");
  if (cronSecret === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getInsForgeAdmin();

  // Everyone who can use the app gets the summary unless they turned it off
  // in Settings (a notification_preferences row only exists once they save).
  const accounts = await adminSql<{ id: string; email: string; name: string | null }>(
    `SELECT id, email, profile->>'name' AS name FROM auth.users
     WHERE email NOT LIKE '%@deleted.invalid'
       AND COALESCE(is_anonymous, false) = false
       AND COALESCE(is_project_admin, false) = false`
  );
  const [{ data: subscriptions }, { data: prefRows, error: prefsError }] = await Promise.all([
    client.database.from("subscriptions").select("*"),
    client.database.from("notification_preferences").select("user_id, weekly_summary"),
  ]);

  if (!accounts || prefsError) {
    console.error("Failed to load weekly summary recipients:", prefsError);
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }

  const optedOut = new Set(
    (prefRows ?? []).filter((p) => p.weekly_summary === false).map((p) => String(p.user_id))
  );
  const subByUser = new Map((subscriptions ?? []).map((sub) => [String(sub.user_id), sub as Subscription]));

  const prefs = accounts
    .filter((a) => !optedOut.has(a.id))
    .filter((a) => getUserAccessLevel(subByUser.get(a.id) ?? null) !== "locked")
    .map((a) => ({ user_id: a.id, email: a.email, name: a.name }));

  if (prefs.length === 0) {
    return NextResponse.json({ message: "No one to send the weekly summary to", sent: 0 });
  }

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const pref of prefs) {
    if (!pref.email) {
      results.push({ userId: pref.user_id, success: false, error: "No email found" });
      continue;
    }

    try {
      // Get latest health assessment
      const { data: assessment } = await client.database
        .from("health_assessments")
        .select("health_score, cash_on_hand, monthly_revenue, monthly_expenses, accounts_receivable")
        .eq("user_id", pref.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assessment) {
        results.push({ userId: pref.user_id, success: false, error: "No assessment data" });
        continue;
      }

      const revenue = assessment.monthly_revenue || 0;
      const expenses = assessment.monthly_expenses || 0;
      const netProfit = revenue - expenses;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      const runwayMonths = expenses > 0 ? (assessment.cash_on_hand || 0) / expenses : 0;

      const html = buildWeeklySummaryEmail({
        userName: pref.name?.trim().split(/\s+/)[0] || "there",
        healthScore: assessment.health_score || 0,
        cashOnHand: assessment.cash_on_hand || 0,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        runwayMonths,
        profitMargin,
        netProfit,
      });

      await getResend().emails.send({
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to: pref.email,
        subject: `MyProfitPulse Weekly Summary — Health Score: ${assessment.health_score || 0}`,
        html,
      });

      results.push({ userId: pref.user_id, success: true });
    } catch (err) {
      console.error(`Failed to send weekly summary to ${pref.user_id}:`, err);
      results.push({
        userId: pref.user_id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, results });
}
