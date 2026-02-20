/**
 * Tests for database schema types and TABLE_NAMES constant.
 * Validates type correctness and table name constants.
 */

import {
  TABLE_NAMES,
  type Profile,
  type Subscription,
  type HealthAssessment,
  type FinancialData,
  type ExpenseCategory,
  type AlertConfig,
  type AlertHistory,
  type Scenario,
  type QuickBooksConnection,
  type ProfileInsert,
  type FinancialDataInsert,
  type DataSource,
  type AlertType,
  type ScenarioType,
  type SubscriptionStatus,
} from "../database.types";

describe("TABLE_NAMES", () => {
  it("contains all 9 required tables", () => {
    const expectedTables = [
      "profiles",
      "subscriptions",
      "health_assessments",
      "financial_data",
      "expense_categories",
      "alert_configs",
      "alert_history",
      "scenarios",
      "quickbooks_connections",
    ];

    expect(Object.values(TABLE_NAMES)).toEqual(expectedTables);
    expect(Object.keys(TABLE_NAMES)).toHaveLength(9);
  });

  it("has correct table name values", () => {
    expect(TABLE_NAMES.profiles).toBe("profiles");
    expect(TABLE_NAMES.subscriptions).toBe("subscriptions");
    expect(TABLE_NAMES.health_assessments).toBe("health_assessments");
    expect(TABLE_NAMES.financial_data).toBe("financial_data");
    expect(TABLE_NAMES.expense_categories).toBe("expense_categories");
    expect(TABLE_NAMES.alert_configs).toBe("alert_configs");
    expect(TABLE_NAMES.alert_history).toBe("alert_history");
    expect(TABLE_NAMES.scenarios).toBe("scenarios");
    expect(TABLE_NAMES.quickbooks_connections).toBe("quickbooks_connections");
  });
});

describe("Type shape validation", () => {
  it("Profile type has required fields", () => {
    const profile: Profile = {
      id: "uuid-1",
      user_id: "user-1",
      business_name: "Acme Corp",
      industry: "Engineering",
      employee_count: 10,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(profile.user_id).toBe("user-1");
    expect(profile.business_name).toBe("Acme Corp");
  });

  it("Profile allows null employee_count", () => {
    const profile: Profile = {
      id: "uuid-1",
      user_id: "user-1",
      business_name: "Solo Shop",
      industry: "Dental",
      employee_count: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(profile.employee_count).toBeNull();
  });

  it("Subscription type has correct tier values", () => {
    const sub: Subscription = {
      id: "uuid-1",
      user_id: "user-1",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      tier: "growth",
      status: "active",
      current_period_end: "2026-02-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(sub.tier).toBe("growth");
    expect(["starter", "growth", "scale"]).toContain(sub.tier);
  });

  it("HealthAssessment type stores financial data and score", () => {
    const assessment: HealthAssessment = {
      id: "uuid-1",
      user_id: "user-1",
      cash_on_hand: 50000,
      monthly_revenue: 25000,
      monthly_expenses: 20000,
      accounts_receivable: 10000,
      employee_count: 5,
      biggest_worry: "Cash flow",
      health_score: 75,
      ai_summary: "Your business is in good shape.",
      recommendations: [
        { title: "Reduce receivables", description: "Follow up on outstanding invoices." },
      ],
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(assessment.health_score).toBe(75);
    expect(assessment.recommendations).toHaveLength(1);
  });

  it("FinancialData type has data_source enum", () => {
    const sources: DataSource[] = ["manual", "spreadsheet", "quickbooks"];
    const data: FinancialData = {
      id: "uuid-1",
      user_id: "user-1",
      period_date: "2026-01-01",
      cash_balance: 50000,
      revenue: 25000,
      expenses: 20000,
      receivables: 10000,
      data_source: "manual",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(sources).toContain(data.data_source);
  });

  it("ExpenseCategory links to financial_data", () => {
    const category: ExpenseCategory = {
      id: "uuid-1",
      financial_data_id: "fd-uuid-1",
      category: "Payroll",
      amount: 15000,
    };
    expect(category.financial_data_id).toBe("fd-uuid-1");
    expect(category.amount).toBe(15000);
  });

  it("AlertConfig has toggle flags", () => {
    const config: AlertConfig = {
      id: "uuid-1",
      user_id: "user-1",
      cash_threshold: 5000,
      expense_increase_pct: 20,
      runway_threshold_months: 3,
      cash_alerts_enabled: true,
      expense_alerts_enabled: true,
      weekly_summary_enabled: true,
      notification_email: "test@example.com",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(config.cash_alerts_enabled).toBe(true);
    expect(config.weekly_summary_enabled).toBe(true);
  });

  it("AlertHistory has alert_type enum", () => {
    const types: AlertType[] = ["cash", "expense", "runway"];
    const alert: AlertHistory = {
      id: "uuid-1",
      user_id: "user-1",
      alert_type: "cash",
      message: "Cash balance below $5,000",
      triggered_at: "2026-01-15T00:00:00Z",
      read: false,
    };
    expect(types).toContain(alert.alert_type);
    expect(alert.read).toBe(false);
  });

  it("Scenario type stores inputs and results as JSON", () => {
    const scenarioTypes: ScenarioType[] = ["break-even", "goal-planning", "hiring", "runway"];
    const scenario: Scenario = {
      id: "uuid-1",
      user_id: "user-1",
      scenario_type: "hiring",
      inputs: { salary: 45000, benefits_pct: 25 },
      result: { affordable: true, new_profit: 5000 },
      ai_explanation: "You can afford to hire at this salary.",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(scenarioTypes).toContain(scenario.scenario_type);
    expect(scenario.inputs).toHaveProperty("salary");
  });

  it("QuickBooksConnection stores encrypted tokens", () => {
    const connection: QuickBooksConnection = {
      id: "uuid-1",
      user_id: "user-1",
      access_token_encrypted: "enc_access_token",
      refresh_token_encrypted: "enc_refresh_token",
      realm_id: "1234567890",
      token_expires_at: "2026-01-01T01:00:00Z",
      last_sync_at: null,
    };
    expect(connection.realm_id).toBe("1234567890");
    expect(connection.last_sync_at).toBeNull();
  });

  it("SubscriptionStatus includes all valid states", () => {
    const statuses: SubscriptionStatus[] = ["active", "canceled", "past_due", "trialing"];
    expect(statuses).toHaveLength(4);
  });
});

describe("Insert types omit auto-generated fields", () => {
  it("ProfileInsert omits id and created_at", () => {
    const insert: ProfileInsert = {
      user_id: "user-1",
      business_name: "Test Co",
      industry: "Construction",
      employee_count: 20,
    };
    expect(insert).not.toHaveProperty("id");
    expect(insert).not.toHaveProperty("created_at");
    expect(insert.user_id).toBe("user-1");
  });

  it("FinancialDataInsert omits id and created_at", () => {
    const insert: FinancialDataInsert = {
      user_id: "user-1",
      period_date: "2026-01-01",
      cash_balance: 50000,
      revenue: 25000,
      expenses: 20000,
      receivables: 10000,
      data_source: "spreadsheet",
    };
    expect(insert).not.toHaveProperty("id");
    expect(insert).not.toHaveProperty("created_at");
    expect(insert.data_source).toBe("spreadsheet");
  });
});
