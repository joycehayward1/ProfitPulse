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
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

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

/** Stripe subscription record */
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: "starter" | "growth" | "scale";
  status: SubscriptionStatus;
  current_period_end: string | null;
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
export type SubscriptionInsert = Omit<Subscription, "id" | "created_at">;
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
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];
