/**
 * GET /api/quickbooks/test
 *
 * Test endpoint: Pulls a Profit & Loss report from QuickBooks
 * to verify the OAuth connection works for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getValidToken, quickbooksGet } from "@/lib/quickbooks";
import { getAuthenticatedUserId } from "@/lib/server-auth";

interface QuickBooksReport {
  Header?: Record<string, unknown>;
  Columns?: Record<string, unknown>;
  Rows?: {
    Row?: unknown[];
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get a valid (possibly refreshed) token
    const { accessToken, realmId } = await getValidToken(userId);

    console.log("Testing QuickBooks connection for realm:", realmId);

    // Pull Profit & Loss report
    const pnlReport = (await quickbooksGet(
      accessToken,
      realmId,
      "/reports/ProfitAndLoss"
    )) as QuickBooksReport;

    console.log("P&L Report retrieved successfully!");
    console.log("Report Header:", JSON.stringify(pnlReport?.Header, null, 2));

    return NextResponse.json({
      success: true,
      realmId,
      report: {
        header: pnlReport?.Header,
        // Include column headers and first few rows for verification
        columns: pnlReport?.Columns,
        rowCount: pnlReport?.Rows?.Row?.length || 0,
        // Full data available but truncated for readability
        sampleRows: pnlReport?.Rows?.Row?.slice(0, 3),
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error("QuickBooks test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch P&L report",
      },
      { status: 500 }
    );
  }
}
