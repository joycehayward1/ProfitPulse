import { NextRequest, NextResponse } from "next/server";
import { runWeeklySummary } from "@/lib/weekly-summary";

/**
 * GET /api/cron/weekly-summary
 *
 * Monday 09:00 UTC (vercel.json). Vercel only sends the Authorization header
 * when CRON_SECRET is set on the project, so without it every scheduled run
 * is rejected with 401.
 *
 * Manual checks (Authorization: Bearer <CRON_SECRET>):
 *   ?dryRun=1             who would get it this week and why the rest are skipped; sends nothing
 *   ?email=a@b.com        limit the run (or dry run) to that one account
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const header = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!header || !secret) return false;
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1" || params.get("dryRun") === "true";
  const report = await runWeeklySummary({ dryRun, onlyEmail: params.get("email") });

  if (!report) {
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }

  console.log("[weekly-summary]", {
    week: report.week,
    dryRun: report.dryRun,
    accounts: report.accounts,
    sent: report.sent,
    wouldSend: report.wouldSend,
    failed: report.failed,
    skipped: report.skipped,
  });

  return NextResponse.json(report);
}
