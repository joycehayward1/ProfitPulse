/**
 * QuickBooks API Helper
 *
 * Handles token management (refresh, validation) and API calls.
 * All tokens are encrypted at rest in the database.
 */

import { getInsForgeAdmin } from "./insforge";
import { encrypt, decrypt } from "./encryption";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com";
const API_MINOR_VERSION = 75;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
}

interface QuickBooksConnection {
  id: string;
  user_id: string;
  realm_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  last_sync_at: string | null;
  created_at?: string;
}

function isMissingCreatedAtColumnError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = (maybeError?.message || "").toLowerCase();

  return maybeError?.code === "PGRST204" || message.includes("created_at");
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const clientId = (process.env.INTUIT_CLIENT_ID ?? process.env.QUICKBOOKS_CLIENT_ID)!;
  const clientSecret = (process.env.INTUIT_CLIENT_SECRET ?? process.env.QUICKBOOKS_CLIENT_SECRET)!;
  const redirectUri = (process.env.INTUIT_REDIRECT_URI ?? process.env.QUICKBOOKS_REDIRECT_URI)!;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Token exchange failed:", response.status, errorBody);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = (process.env.INTUIT_CLIENT_ID ?? process.env.QUICKBOOKS_CLIENT_ID)!;
  const clientSecret = (process.env.INTUIT_CLIENT_SECRET ?? process.env.QUICKBOOKS_CLIENT_SECRET)!;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Token refresh failed:", response.status, errorBody);
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Store QuickBooks connection with encrypted tokens
 */
export async function storeConnection(
  userId: string,
  realmId: string,
  tokens: TokenResponse
): Promise<void> {
  const admin = getInsForgeAdmin();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Check for existing connection for this user
  const { data: existing } = await admin.database
    .from("quickbooks_connections")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  const connectionData = {
    user_id: userId,
    realm_id: realmId,
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    token_expires_at: expiresAt,
  };

  if (existing) {
    // Update existing connection
    const { error } = await admin.database
      .from("quickbooks_connections")
      .update(connectionData)
      .eq("id", existing.id);

    if (error) throw new Error(`Failed to update connection: ${error.message}`);
  } else {
    // Insert new connection
    const { error } = await admin.database
      .from("quickbooks_connections")
      .insert(connectionData);

    if (error) throw new Error(`Failed to store connection: ${error.message}`);
  }
}

/**
 * Get a valid access token for a user.
 * Automatically refreshes if the token is expired or about to expire (within 5 min).
 */
export async function getValidToken(userId: string): Promise<{
  accessToken: string;
  realmId: string;
}> {
  const admin = getInsForgeAdmin();

  const { data: connection, error } = await admin.database
    .from("quickbooks_connections")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  if (error || !connection) {
    throw new Error("No QuickBooks connection found for this user.");
  }

  const conn = connection as QuickBooksConnection;
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Token still valid
  if (expiresAt - now > fiveMinutes) {
    return {
      accessToken: decrypt(conn.access_token_encrypted),
      realmId: conn.realm_id,
    };
  }

  // Token expired or about to expire — refresh it
  console.log("QuickBooks token expired, refreshing...");
  const refreshToken = decrypt(conn.refresh_token_encrypted);
  const newTokens = await refreshAccessToken(refreshToken);

  // Store the new tokens
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  await admin.database
    .from("quickbooks_connections")
    .update({
      access_token_encrypted: encrypt(newTokens.access_token),
      refresh_token_encrypted: encrypt(newTokens.refresh_token),
      token_expires_at: newExpiresAt,
    })
    .eq("id", conn.id);

  return {
    accessToken: newTokens.access_token,
    realmId: conn.realm_id,
  };
}

/**
 * Make an authenticated GET request to the QuickBooks API
 */
export async function quickbooksGet(
  accessToken: string,
  realmId: string,
  endpoint: string
): Promise<unknown> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${SANDBOX_API_BASE}/v3/company/${realmId}${endpoint}${separator}minorversion=${API_MINOR_VERSION}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("QuickBooks API error:", response.status, errorBody);
    throw new Error(`QuickBooks API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get connection status for a user (safe to call from client via API)
 */
export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  realmId?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
}> {
  const admin = getInsForgeAdmin();

  const result = await admin.database
    .from("quickbooks_connections")
    .select("realm_id, last_sync_at, created_at")
    .eq("user_id", userId)
    .limit(1)
    .single();

  let connection: QuickBooksConnection | null = result.data as QuickBooksConnection | null;
  let error = result.error;

  // Backward compatibility for projects where created_at does not exist yet.
  if (error && isMissingCreatedAtColumnError(error)) {
    const fallback = await admin.database
      .from("quickbooks_connections")
      .select("realm_id, last_sync_at")
      .eq("user_id", userId)
      .limit(1)
      .single();
    connection = fallback.data as QuickBooksConnection | null;
    error = fallback.error;
  }

  if (error || !connection) {
    return { connected: false };
  }

  return {
    connected: true,
    realmId: connection.realm_id,
    connectedAt: connection.created_at,
    lastSyncAt: connection.last_sync_at,
  };
}

/**
 * Update last_sync_at timestamp after a successful QuickBooks sync/read.
 */
export async function touchConnectionLastSync(userId: string): Promise<void> {
  const admin = getInsForgeAdmin();

  const { error } = await admin.database
    .from("quickbooks_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update last sync: ${error.message}`);
  }
}

/**
 * Remove a user's QuickBooks connection.
 * This disconnects QuickBooks from the app for future sync operations.
 */
export async function disconnectConnection(userId: string): Promise<void> {
  const admin = getInsForgeAdmin();

  const { error } = await admin.database
    .from("quickbooks_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to disconnect QuickBooks: ${error.message}`);
  }
}
