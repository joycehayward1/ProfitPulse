-- Migration: Waitlist
-- Stores pre-launch signups with UTM tracking for campaign attribution.

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  business_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_url TEXT,
  synced_to_ghl BOOLEAN NOT NULL DEFAULT FALSE,
  synced_to_ghl_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_utm_source ON waitlist(utm_source);

-- No RLS — waitlist is writable by the anon role (public signup form)
-- and readable only via server-side admin routes that check email allowlist.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_insert_anon ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY waitlist_select_none ON waitlist FOR SELECT USING (false);
