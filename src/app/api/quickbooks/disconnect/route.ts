/**
 * DELETE /api/quickbooks/disconnect
 *
 * Disconnects QuickBooks for the authenticated user by removing the stored OAuth connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { disconnectConnection } from "@/lib/quickbooks";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await disconnectConnection(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to disconnect QuickBooks:", err);
    return NextResponse.json(
      { error: "Failed to disconnect QuickBooks" },
      { status: 500 }
    );
  }
}
