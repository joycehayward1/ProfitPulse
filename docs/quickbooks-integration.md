# QuickBooks Integration — ProfitPulse

## Overview

ProfitPulse connects to QuickBooks Online via OAuth 2.0 to automatically sync financial data. This replaces manual data entry with live data from the user's QuickBooks account.

---

## What Was Built

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/encryption.ts` | AES-256-GCM encryption/decryption for storing OAuth tokens securely |
| `src/lib/quickbooks.ts` | Core QuickBooks helper — token exchange, refresh, API calls, connection management |
| `src/app/api/connect/quickbooks/route.ts` | API route that initiates OAuth flow (redirects user to Intuit) |
| `src/app/api/callback/quickbooks/route.ts` | API route that handles Intuit's callback after user authorizes |
| `src/app/api/quickbooks/status/route.ts` | API route to check if a user has an active QuickBooks connection |
| `src/app/api/quickbooks/test/route.ts` | API route that pulls a P&L report to verify the connection works |

### Files Modified

| File | Change |
|------|--------|
| `.env.local` | Added QuickBooks credentials + encryption key |
| `src/app/settings/page.tsx` | Connect/Reconnect/Test buttons with live status display |
| `src/app/assessment/page.tsx` | QuickBooks changed from "Coming Soon" to functional OAuth button |
| `src/app/data/page.tsx` | "Connect QuickBooks" link now routes to OAuth flow |

---

## Environment Variables

Add these to `.env.local`:

```env
# QuickBooks / Intuit OAuth
INTUIT_CLIENT_ID=your_client_id_here
INTUIT_CLIENT_SECRET=your_client_secret_here
INTUIT_REDIRECT_URI=http://localhost:3000/api/callback/quickbooks

# Encryption key for storing OAuth tokens (32 bytes as hex = 64 hex chars)
TOKEN_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

**Where to get these values:**
- `INTUIT_CLIENT_ID` and `INTUIT_CLIENT_SECRET`: From the [Intuit Developer Portal](https://developer.intuit.com/app/developer/dashboard) → your app → Keys & credentials
- `INTUIT_REDIRECT_URI`: Must match exactly what's registered in the Intuit portal
- `TOKEN_ENCRYPTION_KEY`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — use a unique key per environment

---

## Intuit Developer Portal Setup

1. Go to https://developer.intuit.com/app/developer/dashboard
2. Select your app (or create one)
3. Under **Keys & credentials** (or **Keys & OAuth**):
   - Copy the **Client ID** and **Client Secret**
   - Add `http://localhost:3000/api/callback/quickbooks` to **Redirect URIs**
   - For production: add `https://yourdomain.com/api/callback/quickbooks`
4. Save

**Important:** The redirect URI must match character-for-character — no trailing slash, correct protocol (`http` for localhost, `https` for production).

---

## OAuth Flow (Step by Step)

```
User clicks "Connect QuickBooks"
        │
        ▼
GET /api/connect/quickbooks
  → Generates random CSRF state token
  → Stores state in httpOnly cookie (10 min TTL)
  → Redirects to Intuit authorization URL:
    https://appcenter.intuit.com/connect/oauth2
    ?client_id=...
    &response_type=code
    &scope=com.intuit.quickbooks.accounting
    &redirect_uri=http://localhost:3000/api/callback/quickbooks
    &state=<random_hex>
        │
        ▼
User authorizes on Intuit's page
        │
        ▼
Intuit redirects to:
GET /api/callback/quickbooks?code=...&state=...&realmId=...
  → Validates state matches cookie (CSRF protection)
  → Exchanges authorization code for tokens via POST to:
    https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  → Receives: access_token, refresh_token, expires_in
  → Encrypts both tokens with AES-256-GCM
  → Stores in `quickbooks_connections` table
  → Clears state cookie
  → Redirects to /settings?tab=integrations&qb=success
```

---

## Database Table

**Table:** `quickbooks_connections`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (auto-generated) |
| `user_id` | uuid | FK to authenticated user |
| `realm_id` | text | QuickBooks company ID |
| `access_token_encrypted` | text | AES-256-GCM encrypted access token |
| `refresh_token_encrypted` | text | AES-256-GCM encrypted refresh token |
| `token_expires_at` | timestamptz | When the access token expires |
| `connected_at` | timestamptz | When the connection was established |
| `last_sync_at` | timestamptz | Last successful data sync (nullable) |

This table was already defined in `src/lib/database.types.ts` as `QuickBooksConnection`.

**Create this table in InsForge** (if not already created):

```sql
CREATE TABLE quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own connection
CREATE POLICY "Users can view own connection"
  ON quickbooks_connections FOR SELECT
  USING (auth.uid() = user_id);
```

Note: The API routes use the admin/service key to read/write tokens, so RLS won't block server-side operations.

---

## Token Management

### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** 32 bytes from `TOKEN_ENCRYPTION_KEY` env var
- **Storage format:** Base64 string containing `IV (16 bytes) + ciphertext + auth tag (16 bytes)`
- **Location:** `src/lib/encryption.ts`

### Auto-Refresh
The `getValidToken()` function in `src/lib/quickbooks.ts`:
1. Loads the connection from the database
2. Checks if `token_expires_at` is within 5 minutes
3. If valid → decrypts and returns the access token
4. If expired → decrypts refresh token, calls Intuit's token endpoint, encrypts and stores new tokens, returns new access token

QuickBooks access tokens expire after **1 hour**. Refresh tokens are valid for **100 days**.

---

## API Endpoints

### `GET /api/connect/quickbooks`
Initiates OAuth. No parameters needed. Redirects the browser to Intuit.

### `GET /api/callback/quickbooks`
Handles Intuit's redirect. Parameters are set by Intuit:
- `code` — authorization code
- `state` — CSRF state (validated against cookie)
- `realmId` — QuickBooks company ID

### `GET /api/quickbooks/status?user_id=<uuid>`
Returns connection status:
```json
{ "connected": true, "realmId": "123456", "connectedAt": "2026-02-25T...", "lastSyncAt": null }
```
or
```json
{ "connected": false }
```

### `GET /api/quickbooks/test?user_id=<uuid>`
Tests the connection by pulling a Profit & Loss report:
```json
{
  "success": true,
  "realmId": "123456",
  "report": {
    "header": { "ReportName": "ProfitAndLoss", ... },
    "columns": { ... },
    "rowCount": 15,
    "sampleRows": [ ... ]
  }
}
```

---

## QuickBooks API Details

- **Authorization URL:** `https://appcenter.intuit.com/connect/oauth2`
- **Token URL:** `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- **Sandbox API Base:** `https://sandbox-quickbooks.api.intuit.com`
- **Production API Base:** `https://quickbooks.api.intuit.com`
- **Scope:** `com.intuit.quickbooks.accounting`
- **Minor version:** Always append `?minorversion=75` to API calls
- **Auth method for token exchange:** HTTP Basic Auth with `client_id:client_secret`

---

## Where Users Can Connect

1. **Settings → Integrations tab** — Primary location. Shows connection status, Connect/Reconnect/Test buttons.
2. **Assessment onboarding** — "Connect QuickBooks" option alongside Upload and Manual entry.
3. **Data page** — "Or connect QuickBooks for automatic sync" link at bottom of manual entry form.

---

## Testing the Integration

1. Make sure the redirect URI is registered in the Intuit portal
2. Make sure the `quickbooks_connections` table exists in InsForge
3. Go to Settings → Integrations → click "Connect"
4. Authorize in the Intuit popup
5. You should be redirected back with a success message
6. Click "Test Connection" to pull a P&L report
7. Check the terminal/console for logged output

---

## Production Checklist

- [ ] Generate a new `TOKEN_ENCRYPTION_KEY` for production (don't reuse dev key)
- [ ] Update `INTUIT_REDIRECT_URI` to production URL
- [ ] Add production redirect URI in Intuit portal
- [ ] Switch from sandbox to production API base URL in `src/lib/quickbooks.ts`
- [ ] Switch from Intuit sandbox credentials to production credentials
- [ ] Implement data sync logic (pull financials from QB into `financial_data` table)
- [ ] Add sync scheduling (periodic refresh of financial data)
- [ ] Add disconnect functionality (revoke tokens, delete connection row)
