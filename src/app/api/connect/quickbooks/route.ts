/**
 * POST /api/connect/quickbooks
 *
 * Initiates QuickBooks OAuth flow.
 * Generates a CSRF state token, stores it in cookies, and returns the Intuit auth URL.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUserId } from "@/lib/server-auth";

interface ConnectQuickBooksBody {
  returnTo?: string;
}

function normalizeReturnTo(returnTo?: string): string {
  if (!returnTo) return "/assessment";
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/assessment";
  return returnTo;
}

function buildOAuthUrlAndResponse(
  userId: string,
  clientId: string,
  redirectUri: string,
  returnTo: string,
  asJson: boolean
) {
  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");

  // Build Intuit authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  const response = asJson
    ? NextResponse.json({ authUrl })
    : NextResponse.redirect(authUrl);

  // Set state in a secure httpOnly cookie for CSRF validation on callback
  response.cookies.set("qb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  response.cookies.set("qb_oauth_user_id", userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  response.cookies.set("qb_oauth_return_to", returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}

function getOAuthConfig() {
  const clientId = process.env.INTUIT_CLIENT_ID ?? process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.INTUIT_REDIRECT_URI ?? process.env.QUICKBOOKS_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("QuickBooks OAuth is not configured.");
  }

  return { clientId, redirectUri };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: ConnectQuickBooksBody = {};
    try {
      body = (await request.json()) as ConnectQuickBooksBody;
    } catch {
      // Body is optional.
    }
    const returnTo = normalizeReturnTo(body.returnTo);

    const { clientId, redirectUri } = getOAuthConfig();
    return buildOAuthUrlAndResponse(userId, clientId, redirectUri, returnTo, true);
  } catch (err) {
    console.error("Failed to initiate QuickBooks OAuth:", err);
    return NextResponse.json(
      { error: "QuickBooks OAuth is not configured." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/assessment?qb=auth_required", request.url);
  return NextResponse.redirect(redirectUrl);
}
