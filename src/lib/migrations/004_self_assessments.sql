-- Business Financial Self-Assessment (F4B short form), taken once during
-- onboarding before the data step. Private to the user: no admin UI reads it.
-- Applied to production 2026-09-27.

CREATE TABLE IF NOT EXISTS self_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ratings JSONB NOT NULL,
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  pain_point_other TEXT,
  vision TEXT,
  accounting_system TEXT,
  habits_score INTEGER NOT NULL CHECK (habits_score >= 0 AND habits_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE self_assessments ENABLE ROW LEVEL SECURITY;

-- One-time: users can read and create their own row, but not change it.
CREATE POLICY self_assessments_select_own ON self_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY self_assessments_insert_own ON self_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
