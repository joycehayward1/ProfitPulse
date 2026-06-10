/**
 * ProfitPulse Database Schema Types
 *
 * These types mirror the InsForge database tables.
 * All tables have RLS enabled — users can only access their own rows.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type DataSource = "manual" | "spreadsheet" | "quickbooks";
export type AlertType = "cash" | "expense" | "runway";
export type ScenarioType =
  | "break-even"
  | "goal-planning"
  | "hiring"
  | "runway";
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "terminated"
  | "expired";
export type SubscriptionPlan = "pro" | "none";
export type BillingInterval = "monthly" | "annual";
export type PaymentRecordType = "subscription" | "plan_switch" | "renewal" | "refund";
export type PaymentRecordStatus = "success" | "failed" | "voided" | "refunded";

// ─── Tables ───────────────────────────────────────────────────────────────────

/** User profile — created after signup */
export interface Profile {
  id: string;
  user_id: string;
  business_name: string;
  industry: string;
  employee_count: number | null;
  created_at: string;
}

/** Subscription record (Authorize.net ARB) */
export interface Subscription {
  id: string;
  user_id: string;

  // Plan info
  plan: SubscriptionPlan;
  billing_interval: BillingInterval | null;
  subscription_status: SubscriptionStatus;

  // Trial tracking
  trial_start_date: string | null;
  trial_end_date: string | null;

  // Authorize.net references
  anet_customer_profile_id: string | null;
  anet_payment_profile_id: string | null;
  anet_subscription_id: string | null;

  // Billing cycle tracking
  billing_cycle_start_date: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;

  // Plan switch tracking
  pending_switch_to: BillingInterval | null;
  pending_switch_sub_id: string | null;

  // Last payment snapshot
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_payment_status: "success" | "failed" | null;

  /** Locked-in promo rate for renewals (e.g. launch day pricing). */
  pricing_promo: "launch" | null;

  created_at: string;
  updated_at: string;
}

/** Payment history record (Authorize.net transaction) */
export interface PaymentRecord {
  id: string;
  user_id: string;
  anet_transaction_id: string;
  type: PaymentRecordType;
  amount: number;
  status: PaymentRecordStatus;
  billing_interval: BillingInterval;
  description: string;
  created_at: string;
}

/** Health assessment from questionnaire or recalculation */
export interface HealthAssessment {
  id: string;
  user_id: string;
  cash_on_hand: number;
  monthly_revenue: number;
  monthly_expenses: number;
  accounts_receivable: number;
  employee_count: number | null;
  biggest_worry: string | null;
  health_score: number;
  ai_summary: string | null;
  recommendations: Recommendation[] | null;
  created_at: string;
}

export interface Recommendation {
  title: string;
  description: string;
}

/** Monthly financial data — from manual entry, spreadsheet, or QuickBooks */
export interface FinancialData {
  id: string;
  user_id: string;
  period_date: string;
  cash_balance: number;
  revenue: number;
  expenses: number;
  receivables: number;
  data_source: DataSource;
  created_at: string;
}

/** Expense breakdown by category for a financial_data row */
export interface ExpenseCategory {
  id: string;
  financial_data_id: string;
  category: string;
  amount: number;
}

/** User's alert threshold configuration */
export interface AlertConfig {
  id: string;
  user_id: string;
  cash_threshold: number | null;
  expense_increase_pct: number | null;
  runway_threshold_months: number | null;
  cash_alerts_enabled: boolean;
  expense_alerts_enabled: boolean;
  weekly_summary_enabled: boolean;
  notification_email: string | null;
  created_at: string;
}

/** Alert history log */
export interface AlertHistory {
  id: string;
  user_id: string;
  alert_type: AlertType;
  message: string;
  triggered_at: string;
  read: boolean;
}

/** Saved scenario calculation */
export interface Scenario {
  id: string;
  user_id: string;
  scenario_type: ScenarioType;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  ai_explanation: string | null;
  created_at: string;
}

/** Rich financial snapshot — from QuickBooks sync */
export interface FinancialSnapshot {
  id: string;
  user_id: string;
  period_date: string;
  data_source: string;
  total_income: number | null;
  gross_profit: number | null;
  total_expenses: number | null;
  net_operating_income: number | null;
  net_profit: number | null;
  gross_profit_margin: number | null;
  net_profit_margin: number | null;
  current_assets: number | null;
  fixed_assets: number | null;
  total_assets: number | null;
  current_liabilities: number | null;
  long_term_liabilities: number | null;
  equity: number | null;
  operating_activities: number | null;
  investing_activities: number | null;
  financing_activities: number | null;
  net_cash_flow: number | null;
  current_ratio: number | null;
  working_capital: number | null;
  roa: number | null;
  roe: number | null;
  pl_detail: Record<string, number> | null;
  bs_detail: Record<string, number> | null;
  cf_detail: Record<string, number> | null;
  prior_month_date: string | null;
  /** Manual-entry fields (003_manual_entry_fields.sql) */
  accounts_receivable: number | null;
  inventory_value: number | null;
  ytd_revenue: number | null;
  ytd_expenses: number | null;
  expense_breakdown: Record<string, number> | null;
  created_at: string;
}

/** QuickBooks OAuth connection */
export interface QuickBooksConnection {
  id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  realm_id: string;
  token_expires_at: string;
  last_sync_at: string | null;
}

// ─── Insert Types (omit auto-generated fields) ───────────────────────────────

export type ProfileInsert = Omit<Profile, "id" | "created_at">;
export type SubscriptionInsert = Omit<Subscription, "id" | "created_at" | "updated_at">;
export type PaymentRecordInsert = Omit<PaymentRecord, "id" | "created_at">;
export type HealthAssessmentInsert = Omit<HealthAssessment, "id" | "created_at">;
export type FinancialDataInsert = Omit<FinancialData, "id" | "created_at">;
export type ExpenseCategoryInsert = Omit<ExpenseCategory, "id">;
export type AlertConfigInsert = Omit<AlertConfig, "id" | "created_at">;
export type AlertHistoryInsert = Omit<AlertHistory, "id">;
export type ScenarioInsert = Omit<Scenario, "id" | "created_at">;
export type FinancialSnapshotInsert = Omit<FinancialSnapshot, "id" | "created_at">;
export type FinancialSnapshotUpdate = Partial<Omit<FinancialSnapshot, "id" | "created_at">> & { id: string };
export type QuickBooksConnectionInsert = Omit<QuickBooksConnection, "id">;

// ─── Update Types (all fields optional except id) ────────────────────────────

export type ProfileUpdate = Partial<Omit<Profile, "id" | "user_id" | "created_at">>;
export type SubscriptionUpdate = Partial<Omit<Subscription, "id" | "user_id" | "created_at">>;
export type PaymentRecordUpdate = Partial<Omit<PaymentRecord, "id" | "user_id" | "created_at">>;
export type HealthAssessmentUpdate = Partial<Omit<HealthAssessment, "id" | "user_id" | "created_at">>;
export type FinancialDataUpdate = Partial<Omit<FinancialData, "id" | "user_id" | "created_at">>;
export type AlertConfigUpdate = Partial<Omit<AlertConfig, "id" | "user_id" | "created_at">>;
export type ScenarioUpdate = Partial<Omit<Scenario, "id" | "user_id" | "created_at">>;

// ─── Table Names ──────────────────────────────────────────────────────────────

export const TABLE_NAMES = {
  profiles: "profiles",
  subscriptions: "subscriptions",
  health_assessments: "health_assessments",
  financial_data: "financial_data",
  expense_categories: "expense_categories",
  alert_configs: "alert_configs",
  alert_history: "alert_history",
  scenarios: "scenarios",
  quickbooks_connections: "quickbooks_connections",
  financial_snapshots: "financial_snapshots",
  payment_records: "payment_records",
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
