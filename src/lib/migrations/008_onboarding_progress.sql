-- Product tour progress, per user, so a finished or paused tour stays that way
-- across devices and browsers. Holds no financial data: the tour's example
-- dashboard is static in the app and is never written to the database.
-- Not yet applied to production. Until it is, the app keeps tour progress in
-- the browser (localStorage) only and the writes here fail quietly.

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (tour_status IN ('not_started', 'in_progress', 'dismissed', 'completed')),
  tour_step INTEGER NOT NULL DEFAULT 0 CHECK (tour_step >= 0),
  tour_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_progress_select_own ON onboarding_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY onboarding_progress_insert_own ON onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY onboarding_progress_update_own ON onboarding_progress FOR UPDATE USING (auth.uid() = user_id);
