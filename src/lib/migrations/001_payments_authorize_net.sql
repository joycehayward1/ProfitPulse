-- Migration: Replace Stripe subscriptions with Authorize.net ARB schema
-- Adds payment_records table for transaction history
-- Safe to run on databases that have the original Stripe-based subscriptions table.
-- WARNING: This DROPS the existing subscriptions table. Pre-launch only.

BEGIN;

-- ─── Drop old Stripe-based subscriptions table ────────────────────────────────
DROP TABLE IF EXISTS subscriptions CASCADE;

-- ─── Subscriptions (Authorize.net ARB) ────────────────────────────────────────
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan info
  plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('pro', 'none')),
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual')),
  subscription_status TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'terminated', 'expired')),

  -- Trial tracking
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,

  -- Authorize.net references
  anet_customer_profile_id TEXT,
  anet_payment_profile_id TEXT,
  anet_subscription_id TEXT,

  -- Billing cycle tracking
  billing_cycle_start_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,

  -- Plan switch tracking
  pending_switch_to TEXT CHECK (pending_switch_to IN ('monthly', 'annual')),
  pending_switch_sub_id TEXT,

  -- Last payment snapshot
  last_payment_date TIMESTAMPTZ,
  last_payment_amount NUMERIC(12, 2),
  last_payment_status TEXT CHECK (last_payment_status IN ('success', 'failed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── Payment history ──────────────────────────────────────────────────────────
CREATE TABLE payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anet_transaction_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'plan_switch', 'renewal', 'refund')),
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'voided', 'refunded')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_anet_sub_id ON subscriptions(anet_subscription_id);
CREATE INDEX idx_payment_records_user_id ON payment_records(user_id);
CREATE INDEX idx_payment_records_created_at ON payment_records(user_id, created_at DESC);
CREATE INDEX idx_payment_records_anet_txn_id ON payment_records(anet_transaction_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY subscriptions_insert_own ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY subscriptions_update_own ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY subscriptions_delete_own ON subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY payment_records_select_own ON payment_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY payment_records_insert_own ON payment_records FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
