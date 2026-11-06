import { getInsForgeAdmin } from "@/lib/insforge";
import { adminSql } from "@/lib/admin-log";
import { buildWeeklySummaryEmail } from "@/lib/email-templates";
import { getUserAccessLevel } from "@/lib/feature-gate";
import { calculateHealthScore } from "@/lib/healthScore";
import { sendEmailOnce } from "@/lib/lifecycle-emails";
import type { Subscription } from "@/lib/database.types";

/**
 * Monday weekly summary. Goes to every account that can use the app (paid,
 * comped, granted, or in trial) unless they turned it off in Settings, and
 * that has a health assessment to summarise.
 *
 * Sent at most once per account per ISO week (email_log kind
 * "weekly_summary", ref = that week's Monday), so a duplicate cron delivery or
 * a manual re-run never double-sends. A failed send is released and retried by
 * the next run in the same week.
 */

/** Resend's default team limit is a few requests per second; stay under it. */
export const WEEKLY_SUMMARY_SEND_INTERVAL_MS = 600;

export type WeeklySkipReason =
  | "opted_out"
  | "no_access"
  | "no_email"
  | "no_assessment"
  | "already_sent";

export interface WeeklySummaryResult {
  userId: string;
  status: "sent" | "would_send" | "skipped" | "failed";
  reason?: WeeklySkipReason;
}

export interface WeeklySummaryReport {
  week: string;
  dryRun: boolean;
  accounts: number;
  sent: number;
  wouldSend: number;
  failed: number;
  skipped: Partial<Record<WeeklySkipReason, number>>;
  results: WeeklySummaryResult[];
}

export interface WeeklySummaryOptions {
  /** Work out who would get it and why, without sending or claiming anything. */
  dryRun?: boolean;
  /** Only consider the account with this email (case-insensitive). */
  onlyEmail?: string | null;
  now?: Date;
  sendIntervalMs?: number;
}

/** Monday (UTC) of the ISO week containing `date`, as YYYY-MM-DD. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns null when the recipient list can't be loaded. */
export async function runWeeklySummary(
  options: WeeklySummaryOptions = {}
): Promise<WeeklySummaryReport | null> {
  const dryRun = Boolean(options.dryRun);
  const now = options.now ?? new Date();
  const intervalMs = options.sendIntervalMs ?? WEEKLY_SUMMARY_SEND_INTERVAL_MS;
  const week = weekKey(now);
  const onlyEmail = options.onlyEmail?.trim().toLowerCase() || null;
  const client = getInsForgeAdmin();

  const accounts = await adminSql<{ id: string; email: string | null; name: string | null }>(
    `SELECT id, email, profile->>'name' AS name FROM auth.users
     WHERE email NOT LIKE '%@deleted.invalid'
       AND COALESCE(is_anonymous, false) = false
       AND COALESCE(is_project_admin, false) = false
       ${onlyEmail ? "AND lower(email) = $1" : ""}`,
    onlyEmail ? [onlyEmail] : []
  );
  const [{ data: subscriptions, error: subsError }, { data: prefRows, error: prefsError }] =
    await Promise.all([
      client.database.from("subscriptions").select("*"),
      client.database.from("notification_preferences").select("user_id, weekly_summary"),
    ]);

  if (!accounts || subsError || prefsError) {
    console.error("[weekly-summary] failed to load recipients", {
      accounts: Boolean(accounts),
      subsError,
      prefsError,
    });
    return null;
  }

  const optedOut = new Set(
    (prefRows ?? []).filter((p) => p.weekly_summary === false).map((p) => String(p.user_id))
  );
  const subByUser = new Map(
    (subscriptions ?? []).map((sub) => [String(sub.user_id), sub as Subscription])
  );

  const results: WeeklySummaryResult[] = [];
  let sentSinceLastPause = false;

  for (const account of accounts) {
    const skip = (reason: WeeklySkipReason) =>
      results.push({ userId: account.id, status: "skipped", reason });

    if (optedOut.has(account.id)) {
      skip("opted_out");
      continue;
    }
    if (getUserAccessLevel(subByUser.get(account.id) ?? null) === "locked") {
      skip("no_access");
      continue;
    }
    if (!account.email) {
      skip("no_email");
      continue;
    }

    try {
      const { data: assessment } = await client.database
        .from("health_assessments")
        .select("cash_on_hand, monthly_revenue, monthly_expenses, accounts_receivable")
        .eq("user_id", account.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assessment) {
        skip("no_assessment");
        continue;
      }

      if (dryRun) {
        results.push({ userId: account.id, status: "would_send" });
        continue;
      }

      const cashOnHand = Number(assessment.cash_on_hand) || 0;
      const revenue = Number(assessment.monthly_revenue) || 0;
      const expenses = Number(assessment.monthly_expenses) || 0;
      const receivables = Number(assessment.accounts_receivable) || 0;
      const netProfit = revenue - expenses;
      // Same calculation as the dashboard, so the email and the app agree.
      const healthScore = calculateHealthScore({
        cashOnHand,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        accountsReceivable: receivables,
      }).totalScore;

      if (sentSinceLastPause && intervalMs > 0) await sleep(intervalMs);

      const outcome = await sendEmailOnce({
        userId: account.id,
        kind: "weekly_summary",
        ref: week,
        to: account.email,
        subject: `MyProfitPulse Weekly Summary — Health Score: ${healthScore}`,
        html: buildWeeklySummaryEmail({
          userName: firstName(account.name),
          healthScore,
          cashOnHand,
          monthlyRevenue: revenue,
          monthlyExpenses: expenses,
          runwayMonths: expenses > 0 ? cashOnHand / expenses : 0,
          profitMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
          netProfit,
        }),
      });
      sentSinceLastPause = outcome !== "duplicate";

      if (outcome === "sent") results.push({ userId: account.id, status: "sent" });
      else if (outcome === "duplicate") skip("already_sent");
      else results.push({ userId: account.id, status: "failed" });
    } catch (err) {
      console.error(`[weekly-summary] failed for ${account.id}:`, err);
      results.push({ userId: account.id, status: "failed" });
    }
  }

  const skipped: Partial<Record<WeeklySkipReason, number>> = {};
  for (const r of results) {
    if (r.reason) skipped[r.reason] = (skipped[r.reason] ?? 0) + 1;
  }

  return {
    week,
    dryRun,
    accounts: accounts.length,
    sent: results.filter((r) => r.status === "sent").length,
    wouldSend: results.filter((r) => r.status === "would_send").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped,
    results,
  };
}
