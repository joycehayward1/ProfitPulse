-- Admin back-office: an audit log of admin actions, and optional free-access
-- length for comped emails (NULL = lifetime, the original behavior).
-- Applied to production 2026-09-27.

CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id, created_at DESC);

-- Server routes only (admin key); no user-facing policies.
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

ALTER TABLE comped_emails ADD COLUMN IF NOT EXISTS access_months INTEGER
  CHECK (access_months IS NULL OR (access_months >= 1 AND access_months <= 120));
