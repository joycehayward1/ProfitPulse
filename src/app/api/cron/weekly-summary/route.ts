import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend";
import { buildWeeklySummaryEmail } from "@/lib/email-templates";

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

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Get all users who have weekly_summary enabled (email stored in preferences)
  const { data: prefs, error: prefsError } = await client.database
    .from("notification_preferences")
    .select("user_id, email")
    .eq("weekly_summary", true);

  if (prefsError) {
    console.error("Failed to fetch notification preferences:", prefsError);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }

  if (!prefs || prefs.length === 0) {
    return NextResponse.json({ message: "No users with weekly summary enabled", sent: 0 });
  }

  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const pref of prefs) {
    if (!pref.email) {
      results.push({ userId: pref.user_id, success: false, error: "No email found" });
      continue;
    }

    try {
      // Get user name from profiles (optional)
      const { data: profile } = await client.database
        .from("profiles")
        .select("name")
        .eq("user_id", pref.user_id)
        .single();

      // Get latest health assessment
      const { data: assessment } = await client.database
        .from("health_assessments")
        .select("health_score, cash_on_hand, monthly_revenue, monthly_expenses, accounts_receivable")
        .eq("user_id", pref.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

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
        userName: profile?.name || "there",
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
