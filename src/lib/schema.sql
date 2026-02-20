-- ProfitPulse Database Schema
-- Creates all tables with Row Level Security (RLS) policies
-- Users can only access their own data

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  employee_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Stripe subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'growth', 'scale')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Health assessments
CREATE TABLE IF NOT EXISTS health_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_on_hand NUMERIC(12, 2) NOT NULL,
  monthly_revenue NUMERIC(12, 2) NOT NULL,
  monthly_expenses NUMERIC(12, 2) NOT NULL,
  accounts_receivable NUMERIC(12, 2) NOT NULL,
  employee_count INTEGER,
  biggest_worry TEXT,
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  ai_summary TEXT,
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial data (monthly snapshots)
CREATE TABLE IF NOT EXISTS financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  cash_balance NUMERIC(12, 2) NOT NULL,
  revenue NUMERIC(12, 2) NOT NULL,
  expenses NUMERIC(12, 2) NOT NULL,
  receivables NUMERIC(12, 2) NOT NULL,
  data_source TEXT NOT NULL CHECK (data_source IN ('manual', 'spreadsheet', 'quickbooks')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expense categories (breakdown for financial_data)
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_data_id UUID NOT NULL REFERENCES financial_data(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL
);

-- Alert configuration
CREATE TABLE IF NOT EXISTS alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_threshold NUMERIC(12, 2),
  expense_increase_pct NUMERIC(5, 2),
  runway_threshold_months INTEGER,
  cash_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  expense_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notification_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('cash', 'expense', 'runway')),
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Saved scenarios
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('break-even', 'goal-planning', 'hiring', 'runway')),
  inputs JSONB NOT NULL,
  result JSONB NOT NULL,
  ai_explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QuickBooks OAuth connections
CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_health_assessments_user_id ON health_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_health_assessments_created_at ON health_assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_data_user_id ON financial_data(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_data_period ON financial_data(user_id, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_categories_financial_data_id ON expense_categories(financial_data_id);
CREATE INDEX IF NOT EXISTS idx_alert_configs_user_id ON alert_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON scenarios(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quickbooks_connections_user_id ON quickbooks_connections(user_id);

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/write their own profile
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY profiles_insert_own ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY profiles_delete_own ON profiles FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions: Users can read/write their own subscription
CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subscriptions_insert_own ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subscriptions_update_own ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY subscriptions_delete_own ON subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Health Assessments: Users can read/write their own assessments
CREATE POLICY health_assessments_select_own ON health_assessments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY health_assessments_insert_own ON health_assessments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY health_assessments_update_own ON health_assessments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY health_assessments_delete_own ON health_assessments FOR DELETE USING (auth.uid() = user_id);

-- Financial Data: Users can read/write their own data
CREATE POLICY financial_data_select_own ON financial_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY financial_data_insert_own ON financial_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY financial_data_update_own ON financial_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY financial_data_delete_own ON financial_data FOR DELETE USING (auth.uid() = user_id);

-- Expense Categories: Users can access categories for their financial_data
CREATE POLICY expense_categories_select_own ON expense_categories FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM financial_data
    WHERE financial_data.id = expense_categories.financial_data_id
    AND financial_data.user_id = auth.uid()
  ));
CREATE POLICY expense_categories_insert_own ON expense_categories FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM financial_data
    WHERE financial_data.id = expense_categories.financial_data_id
    AND financial_data.user_id = auth.uid()
  ));
CREATE POLICY expense_categories_update_own ON expense_categories FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM financial_data
    WHERE financial_data.id = expense_categories.financial_data_id
    AND financial_data.user_id = auth.uid()
  ));
CREATE POLICY expense_categories_delete_own ON expense_categories FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM financial_data
    WHERE financial_data.id = expense_categories.financial_data_id
    AND financial_data.user_id = auth.uid()
  ));

-- Alert Configs: Users can read/write their own config
CREATE POLICY alert_configs_select_own ON alert_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY alert_configs_insert_own ON alert_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY alert_configs_update_own ON alert_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY alert_configs_delete_own ON alert_configs FOR DELETE USING (auth.uid() = user_id);

-- Alert History: Users can read/write their own alerts
CREATE POLICY alert_history_select_own ON alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY alert_history_insert_own ON alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY alert_history_update_own ON alert_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY alert_history_delete_own ON alert_history FOR DELETE USING (auth.uid() = user_id);

-- Scenarios: Users can read/write their own scenarios
CREATE POLICY scenarios_select_own ON scenarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY scenarios_insert_own ON scenarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY scenarios_update_own ON scenarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY scenarios_delete_own ON scenarios FOR DELETE USING (auth.uid() = user_id);

-- QuickBooks Connections: Users can read/write their own connection
CREATE POLICY quickbooks_connections_select_own ON quickbooks_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY quickbooks_connections_insert_own ON quickbooks_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY quickbooks_connections_update_own ON quickbooks_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY quickbooks_connections_delete_own ON quickbooks_connections FOR DELETE USING (auth.uid() = user_id);
