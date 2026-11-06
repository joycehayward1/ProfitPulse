-- Small app-wide settings that an admin can change without a redeploy.
-- Today it holds one value: the Tutorials link (key 'tutorials_url'), edited
-- in the Admin Panel > Settings tab. An empty value hides the link; no row
-- means "use NEXT_PUBLIC_TUTORIALS_URL, then the built-in default".
-- Not yet applied to production. Until it is, the app uses that fallback and
-- saving in the Admin Panel reports an error.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone signed in (or not) may read the public link; nobody can write from
-- the browser. Writes happen only in /api/admin/tutorials-url, which checks
-- ADMIN_EMAILS and uses the server-only admin key.
CREATE POLICY app_settings_read_tutorials_url ON app_settings
  FOR SELECT USING (key = 'tutorials_url');
