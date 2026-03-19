/**
 * ProfitPulse Database Migration Script
 *
 * Creates all tables in InsForge using the Admin API.
 * Run with: npx tsx scripts/migrate.ts
 *
 * Requires environment variables:
 *   NEXT_PUBLIC_INSFORGE_URL - InsForge project base URL
 *   INSFORGE_API_KEY - Admin API key (X-API-Key header)
 *
 * Tables are created with RLS enabled. InsForge automatically enforces
 * that authenticated users can only access their own rows via JWT user_id.
 */

interface Column {
  name: string;
  type: "string" | "datetime" | "integer" | "float" | "boolean" | "uuid" | "json";
  nullable: boolean;
  unique?: boolean;
  defaultValue?: string;
  foreignKey?: {
    table: string;
    column: string;
    onDelete?: "CASCADE" | "SET NULL" | "NO ACTION" | "RESTRICT";
  };
}

interface TableDefinition {
  tableName: string;
  columns: Column[];
  rlsEnabled: boolean;
}

// ─── Table Definitions ────────────────────────────────────────────────────────

const tables: TableDefinition[] = [
  {
    tableName: "profiles",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false, unique: true },
      { name: "business_name", type: "string", nullable: false },
      { name: "industry", type: "string", nullable: false },
      { name: "employee_count", type: "integer", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "subscriptions",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false, unique: true },
      { name: "stripe_customer_id", type: "string", nullable: true },
      { name: "stripe_subscription_id", type: "string", nullable: true },
      { name: "tier", type: "string", nullable: false, defaultValue: "starter" },
      { name: "status", type: "string", nullable: false, defaultValue: "active" },
      { name: "current_period_end", type: "datetime", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "health_assessments",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false },
      { name: "cash_on_hand", type: "float", nullable: false },
      { name: "monthly_revenue", type: "float", nullable: false },
      { name: "monthly_expenses", type: "float", nullable: false },
      { name: "accounts_receivable", type: "float", nullable: false },
      { name: "employee_count", type: "integer", nullable: true },
      { name: "biggest_worry", type: "string", nullable: true },
      { name: "health_score", type: "integer", nullable: false },
      { name: "ai_summary", type: "string", nullable: true },
      { name: "recommendations", type: "json", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "financial_data",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false },
      { name: "period_date", type: "datetime", nullable: false },
      { name: "cash_balance", type: "float", nullable: false },
      { name: "revenue", type: "float", nullable: false },
      { name: "expenses", type: "float", nullable: false },
      { name: "receivables", type: "float", nullable: false },
      { name: "data_source", type: "string", nullable: false, defaultValue: "manual" },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "expense_categories",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      {
        name: "financial_data_id",
        type: "string",
        nullable: false,
        foreignKey: {
          table: "financial_data",
          column: "id",
          onDelete: "CASCADE",
        },
      },
      { name: "category", type: "string", nullable: false },
      { name: "amount", type: "float", nullable: false },
    ],
  },
  {
    tableName: "alert_configs",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false, unique: true },
      { name: "cash_threshold", type: "float", nullable: true },
      { name: "expense_increase_pct", type: "float", nullable: true },
      { name: "runway_threshold_months", type: "integer", nullable: true },
      { name: "cash_alerts_enabled", type: "boolean", nullable: false, defaultValue: "false" },
      { name: "expense_alerts_enabled", type: "boolean", nullable: false, defaultValue: "false" },
      { name: "weekly_summary_enabled", type: "boolean", nullable: false, defaultValue: "true" },
      { name: "notification_email", type: "string", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "alert_history",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false },
      { name: "alert_type", type: "string", nullable: false },
      { name: "message", type: "string", nullable: false },
      { name: "triggered_at", type: "datetime", nullable: false },
      { name: "read", type: "boolean", nullable: false, defaultValue: "false" },
    ],
  },
  {
    tableName: "scenarios",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false },
      { name: "scenario_type", type: "string", nullable: false },
      { name: "inputs", type: "json", nullable: false },
      { name: "result", type: "json", nullable: false },
      { name: "ai_explanation", type: "string", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "quickbooks_connections",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false, unique: true },
      { name: "access_token_encrypted", type: "string", nullable: false },
      { name: "refresh_token_encrypted", type: "string", nullable: false },
      { name: "realm_id", type: "string", nullable: false },
      { name: "token_expires_at", type: "datetime", nullable: false },
      { name: "last_sync_at", type: "datetime", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
  {
    tableName: "financial_snapshots",
    rlsEnabled: true,
    columns: [
      { name: "id", type: "uuid", nullable: false, unique: true },
      { name: "user_id", type: "string", nullable: false },
      { name: "period_date", type: "datetime", nullable: false },
      { name: "data_source", type: "string", nullable: false },
      { name: "total_income", type: "float", nullable: true },
      { name: "gross_profit", type: "float", nullable: true },
      { name: "total_expenses", type: "float", nullable: true },
      { name: "net_operating_income", type: "float", nullable: true },
      { name: "net_profit", type: "float", nullable: true },
      { name: "gross_profit_margin", type: "float", nullable: true },
      { name: "net_profit_margin", type: "float", nullable: true },
      { name: "current_assets", type: "float", nullable: true },
      { name: "fixed_assets", type: "float", nullable: true },
      { name: "total_assets", type: "float", nullable: true },
      { name: "current_liabilities", type: "float", nullable: true },
      { name: "long_term_liabilities", type: "float", nullable: true },
      { name: "equity", type: "float", nullable: true },
      { name: "operating_activities", type: "float", nullable: true },
      { name: "investing_activities", type: "float", nullable: true },
      { name: "financing_activities", type: "float", nullable: true },
      { name: "net_cash_flow", type: "float", nullable: true },
      { name: "current_ratio", type: "float", nullable: true },
      { name: "working_capital", type: "float", nullable: true },
      { name: "roa", type: "float", nullable: true },
      { name: "roe", type: "float", nullable: true },
      { name: "pl_detail", type: "json", nullable: true },
      { name: "bs_detail", type: "json", nullable: true },
      { name: "cf_detail", type: "json", nullable: true },
      { name: "prior_month_date", type: "datetime", nullable: true },
      { name: "created_at", type: "datetime", nullable: false },
    ],
  },
];

// ─── Migration Runner ─────────────────────────────────────────────────────────

async function createTable(
  baseUrl: string,
  apiKey: string,
  table: TableDefinition
): Promise<void> {
  const response = await fetch(`${baseUrl}/api/database/tables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(table),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create table '${table.tableName}': ${response.status} - ${error}`);
  }

  console.log(`  ✓ Created table: ${table.tableName} (RLS: ${table.rlsEnabled})`);
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error("Missing environment variables:");
    if (!baseUrl) console.error("  - NEXT_PUBLIC_INSFORGE_URL");
    if (!apiKey) console.error("  - INSFORGE_API_KEY");
    console.error("\nSet these in .env.local before running migrations.");
    process.exit(1);
  }

  console.log(`\nProfitPulse Database Migration`);
  console.log(`Target: ${baseUrl}`);
  console.log(`Tables: ${tables.length}\n`);

  for (const table of tables) {
    try {
      await createTable(baseUrl, apiKey, table);
    } catch (error) {
      console.error(`  ✗ ${(error as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\nMigration complete. ${tables.length} tables created with RLS enabled.`);
}

main();
