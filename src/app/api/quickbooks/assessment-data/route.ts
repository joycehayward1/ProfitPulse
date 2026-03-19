/**
 * GET /api/quickbooks/assessment-data
 *
 * Pulls key assessment metrics from QuickBooks and maps them to the
 * questionnaire fields for a pre-filled onboarding experience.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-auth";
import { getValidToken, quickbooksGet, touchConnectionLastSync } from "@/lib/quickbooks";

interface ReportColDataItem {
  value?: string;
}

interface ReportRow {
  ColData?: ReportColDataItem[];
  Summary?: {
    ColData?: ReportColDataItem[];
  };
  Rows?: {
    Row?: ReportRow[];
  };
}

interface QuickBooksReportPayload {
  Rows?: {
    Row?: ReportRow[];
  };
}

interface ExtractedMetrics {
  cash: number;
  revenue: number;
  expenses: number;
  receivables: number;
  payables: number;
  ytdRevenue: number;
  ytdExpenses: number;
  inventoryValue: number;
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCurrency(raw?: string): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  const isNegative = /^\(.*\)$/.test(trimmed);
  const numericRaw = trimmed
    .replace(/[(),$%\s]/g, "")
    .replace(/,/g, "");
  const parsed = Number.parseFloat(numericRaw);
  if (!Number.isFinite(parsed)) return 0;

  return isNegative ? -parsed : parsed;
}

function collectRowValues(rows: ReportRow[] | undefined, out: Map<string, number>): void {
  if (!rows) return;

  for (const row of rows) {
    const candidates: Array<ReportColDataItem[] | undefined> = [
      row.Summary?.ColData,
      row.ColData,
    ];

    for (const colData of candidates) {
      if (!colData || colData.length < 2) continue;
      const label = colData[0]?.value?.trim();
      const valueRaw = colData[colData.length - 1]?.value;
      if (!label || !valueRaw) continue;

      const key = normalizeLabel(label);
      const value = parseCurrency(valueRaw);
      if (!Number.isFinite(value)) continue;

      // Prefer explicit total rows when available.
      if (!out.has(key) || key.startsWith("total")) {
        out.set(key, value);
      }
    }

    collectRowValues(row.Rows?.Row, out);
  }
}

function firstMatchingValue(map: Map<string, number>, labels: string[]): number {
  for (const label of labels) {
    const key = normalizeLabel(label);
    if (map.has(key)) {
      return map.get(key) ?? 0;
    }
  }
  return 0;
}

function extractIncomeExpense(report: QuickBooksReportPayload): {
  income: number;
  expenses: number;
} {
  const values = new Map<string, number>();
  collectRowValues(report.Rows?.Row, values);

  const income = firstMatchingValue(values, [
    "Total Income",
    "Total Revenue",
    "Income",
    "Revenue",
  ]);
  const expenses = Math.abs(
    firstMatchingValue(values, [
      "Total Expenses",
      "Total Expense",
      "Expenses",
      "Expense",
    ])
  );

  return { income, expenses };
}

function extractBalanceSheetMetrics(report: QuickBooksReportPayload): {
  cash: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
} {
  const values = new Map<string, number>();
  collectRowValues(report.Rows?.Row, values);

  const cash = firstMatchingValue(values, [
    "Total Bank Accounts",
    "Total Cash and Cash Equivalents",
    "Cash and Cash Equivalents",
    "Cash",
  ]);
  const receivables = firstMatchingValue(values, [
    "Total Accounts Receivable (A/R)",
    "Accounts Receivable (A/R)",
    "Total Accounts Receivable",
    "Accounts Receivable",
  ]);
  const payables = Math.abs(
    firstMatchingValue(values, [
      "Total Accounts Payable (A/P)",
      "Accounts Payable (A/P)",
      "Total Accounts Payable",
      "Accounts Payable",
    ])
  );
  const inventoryValue = firstMatchingValue(values, [
    "Total Inventory Asset",
    "Inventory Asset",
    "Total Inventory",
    "Inventory",
  ]);

  return { cash, receivables, payables, inventoryValue };
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getLastMonthRange(now: Date): { start: string; end: string } {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthEnd = new Date(currentMonthStart.getTime() - 24 * 60 * 60 * 1000);
  const lastMonthStart = new Date(
    Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1)
  );

  return {
    start: formatDateISO(lastMonthStart),
    end: formatDateISO(lastMonthEnd),
  };
}

function getYtdStart(now: Date): string {
  return formatDateISO(new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accessToken, realmId } = await getValidToken(userId);

    const now = new Date();
    const today = formatDateISO(now);
    const { start: monthlyStart, end: monthlyEnd } = getLastMonthRange(now);
    const ytdStart = getYtdStart(now);

    const [monthlyPnlRaw, ytdPnlRaw, balanceSheetRaw, cashFlowRaw] = await Promise.all([
      quickbooksGet(
        accessToken,
        realmId,
        `/reports/ProfitAndLoss?start_date=${monthlyStart}&end_date=${monthlyEnd}`
      ),
      quickbooksGet(
        accessToken,
        realmId,
        `/reports/ProfitAndLoss?start_date=${ytdStart}&end_date=${today}`
      ),
      quickbooksGet(
        accessToken,
        realmId,
        `/reports/BalanceSheet?end_date=${today}`
      ),
      quickbooksGet(
        accessToken,
        realmId,
        `/reports/CashFlow?start_date=${monthlyStart}&end_date=${monthlyEnd}`
      ),
    ]);

    const monthlyPnl = monthlyPnlRaw as QuickBooksReportPayload;
    const ytdPnl = ytdPnlRaw as QuickBooksReportPayload;
    const balanceSheet = balanceSheetRaw as QuickBooksReportPayload;
    const cashFlowReport = cashFlowRaw as QuickBooksReportPayload;

    const monthly = extractIncomeExpense(monthlyPnl);
    const ytd = extractIncomeExpense(ytdPnl);
    const bs = extractBalanceSheetMetrics(balanceSheet);

    // Collect full line-item maps for detail storage
    const plValues = new Map<string, number>();
    collectRowValues(monthlyPnl.Rows?.Row, plValues);

    const bsValues = new Map<string, number>();
    collectRowValues(balanceSheet.Rows?.Row, bsValues);

    const cfValues = new Map<string, number>();
    collectRowValues(cashFlowReport.Rows?.Row, cfValues);

    // Extract balance sheet category totals
    const currentAssets = firstMatchingValue(bsValues, [
      "Total Current Assets",
      "Current Assets",
    ]);
    const fixedAssets = firstMatchingValue(bsValues, [
      "Total Fixed Assets",
      "Fixed Assets",
      "Total Property, Plant and Equipment",
    ]);
    const totalAssets = firstMatchingValue(bsValues, [
      "TOTAL ASSETS",
      "Total Assets",
    ]);
    const currentLiabilities = firstMatchingValue(bsValues, [
      "Total Current Liabilities",
      "Current Liabilities",
    ]);
    const longTermLiabilities = firstMatchingValue(bsValues, [
      "Total Long-Term Liabilities",
      "Long-Term Liabilities",
      "Total Non-Current Liabilities",
    ]);
    const equity = firstMatchingValue(bsValues, [
      "Total Equity",
      "Equity",
      "Total Stockholders Equity",
    ]);

    // Extract cash flow category totals
    const operatingActivities = firstMatchingValue(cfValues, [
      "Net cash provided by operating activities",
      "OPERATING ACTIVITIES",
      "Total Operating Activities",
    ]);
    const investingActivities = firstMatchingValue(cfValues, [
      "Net cash provided by investing activities",
      "INVESTING ACTIVITIES",
      "Total Investing Activities",
    ]);
    const financingActivities = firstMatchingValue(cfValues, [
      "Net cash provided by financing activities",
      "FINANCING ACTIVITIES",
      "Total Financing Activities",
    ]);

    // Extract net operating income from P&L
    const netOperatingIncome = firstMatchingValue(plValues, [
      "Net Operating Income",
      "Net Income",
      "Net Profit",
    ]);

    // Derived fields with divide-by-zero guards
    const totalIncome = monthly.income;
    const totalExpenses = monthly.expenses;
    const grossProfit = totalIncome - totalExpenses;
    const netProfit = netOperatingIncome;
    const grossProfitMargin = totalIncome !== 0 ? grossProfit / totalIncome : null;
    const netProfitMargin = totalIncome !== 0 ? netProfit / totalIncome : null;
    const workingCapital = currentAssets - currentLiabilities;
    const currentRatio = currentLiabilities !== 0 ? currentAssets / currentLiabilities : null;
    const netCashFlow = operatingActivities + investingActivities + financingActivities;
    const roa = totalAssets !== 0 ? netProfit / totalAssets : null;
    const roe = equity !== 0 ? netProfit / equity : null;

    // Convert maps to plain objects for JSON storage
    const plDetail: Record<string, number> = Object.fromEntries(plValues);
    const bsDetail: Record<string, number> = Object.fromEntries(bsValues);
    const cfDetail: Record<string, number> = Object.fromEntries(cfValues);

    const richSnapshot = {
      period_date: monthlyEnd,
      data_source: "quickbooks",
      total_income: totalIncome,
      gross_profit: grossProfit,
      total_expenses: totalExpenses,
      net_operating_income: netOperatingIncome,
      net_profit: netProfit,
      gross_profit_margin: grossProfitMargin,
      net_profit_margin: netProfitMargin,
      current_assets: currentAssets,
      fixed_assets: fixedAssets,
      total_assets: totalAssets,
      current_liabilities: currentLiabilities,
      long_term_liabilities: longTermLiabilities,
      equity,
      operating_activities: operatingActivities,
      investing_activities: investingActivities,
      financing_activities: financingActivities,
      net_cash_flow: netCashFlow,
      current_ratio: currentRatio,
      working_capital: workingCapital,
      roa,
      roe,
      pl_detail: plDetail,
      bs_detail: bsDetail,
      cf_detail: cfDetail,
    };

    const metrics: ExtractedMetrics = {
      cash: bs.cash,
      revenue: monthly.income,
      expenses: monthly.expenses,
      receivables: bs.receivables,
      payables: bs.payables,
      ytdRevenue: ytd.income,
      ytdExpenses: ytd.expenses,
      inventoryValue: bs.inventoryValue,
    };

    try {
      await touchConnectionLastSync(userId);
    } catch (syncErr) {
      console.warn("Failed to update quickbooks last_sync_at:", syncErr);
    }

    return NextResponse.json({
      success: true,
      realmId,
      pulledAt: new Date().toISOString(),
      periods: {
        monthlyStart,
        monthlyEnd,
        ytdStart,
        ytdEnd: today,
      },
      metrics,
      richSnapshot,
    });
  } catch (err) {
    const error = err as Error;
    console.error("QuickBooks assessment sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync data from QuickBooks",
      },
      { status: 500 }
    );
  }
}
