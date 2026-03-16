/**
 * GET /api/callback/quickbooks
 *
 * Handles the OAuth callback from Intuit.
 * Validates state, exchanges code for tokens, encrypts and stores them.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, storeConnection } from "@/lib/quickbooks";
import { getInsForgeAdmin } from "@/lib/insforge";

export async function GET(request: NextRequest) {
  const storedReturnTo = request.cookies.get("qb_oauth_return_to")?.value;
  const safeReturnTo =
    storedReturnTo && storedReturnTo.startsWith("/") && !storedReturnTo.startsWith("//")
      ? storedReturnTo
      : "/assessment";

  const buildRedirectPath = (qbResult: "success" | "error" | "auth_required") => {
    const url = new URL(safeReturnTo, request.url);
    url.searchParams.set("qb", qbResult);
    return `${url.pathname}${url.search}`;
  };

  const redirectWithCleanup = (path: string) => {
    const redirectUrl = new URL(path, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("qb_oauth_state");
    response.cookies.delete("qb_oauth_user_id");
    response.cookies.delete("qb_oauth_return_to");
    return response;
  };

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  // Handle user denial or errors from Intuit
  if (error) {
    console.error("QuickBooks OAuth error:", error);
    return redirectWithCleanup(buildRedirectPath("error"));
  }

  // Validate required params
  if (!code || !state || !realmId) {
    console.error("Missing OAuth callback parameters:", { code: !!code, state: !!state, realmId: !!realmId });
    return redirectWithCleanup(buildRedirectPath("error"));
  }

  // Validate CSRF state
  const storedState = request.cookies.get("qb_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    console.error("State mismatch — possible CSRF attack");
    return redirectWithCleanup(buildRedirectPath("error"));
  }

  try {
    // Get current user from InsForge session
    // We need to extract user from the auth cookie/session
    const admin = getInsForgeAdmin();
    const oauthUserId = request.cookies.get("qb_oauth_user_id")?.value;

    // Get user ID from InsForge auth cookie
    // The InsForge SDK stores the session token in cookies
    const authCookie = request.cookies.get("insforge_auth_token")?.value
      || request.cookies.get("sb-access-token")?.value
      || request.cookies.get("auth-token")?.value;

    let userId: string | null = oauthUserId || null;

    if (!userId && authCookie) {
      // Try to get user from the token
      try {
        // Use admin client to verify the user
        const { data: sessionData } = await admin.database
          .from("auth_sessions")
          .select("user_id")
          .eq("token", authCookie)
          .limit(1)
          .single();

        if (sessionData) {
          userId = sessionData.user_id;
        }
      } catch {
        // Fallback: try to decode the session from InsForge
      }
    }

    // Fallback: infer from auth/session cookies when OAuth user cookie is missing.
    if (!userId) {
      // Try getting user from the InsForge session cookie pattern
      const allCookies = request.cookies.getAll();
      const insForgeSessionCookie = allCookies.find(
        (c) => c.name.includes("insforge") || c.name.includes("auth") || c.name.includes("session")
      );

      if (insForgeSessionCookie) {
        console.log("Found auth cookie:", insForgeSessionCookie.name);
      }
    }

    if (!userId) {
      console.error("Could not identify authenticated user during OAuth callback");
      // Redirect to settings with error - user needs to be logged in
      return redirectWithCleanup(buildRedirectPath("auth_required"));
    }

    // Exchange authorization code for tokens
    console.log("Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(code);
    console.log("Token exchange successful, expires_in:", tokens.expires_in);

    // Store encrypted tokens in database
    await storeConnection(userId, realmId, tokens);
    console.log("QuickBooks connection stored for user:", userId, "realmId:", realmId);

    // Clear the state cookie
    return redirectWithCleanup(buildRedirectPath("success"));
  } catch (err) {
    console.error("QuickBooks OAuth callback error:", err);
    return redirectWithCleanup(buildRedirectPath("error"));
  }
}
