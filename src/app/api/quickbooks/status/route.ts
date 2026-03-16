/**
 * GET /api/quickbooks/status
 *
 * Returns QuickBooks connection status for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/quickbooks";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const status = await getConnectionStatus(userId);
    return NextResponse.json(status);
  } catch (err) {
    console.error("Error checking QuickBooks status:", err);
    return NextResponse.json(
      { error: "Failed to check connection status" },
      { status: 500 }
    );
  }
}
