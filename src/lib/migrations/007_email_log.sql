-- Lifecycle emails (payment declined, trial ending, trial ended) are sent at
-- most once per event: the unique key is (user, kind of email, event ref).
-- Applied to production 2026-09-27.

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, ref)
);

-- Server routes only (admin key); no user-facing policies.
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
