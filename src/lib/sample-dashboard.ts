/**
 * Example numbers for the new-account dashboard preview. A made-up business,
 * shown only in the browser and always labelled as example data. Never write
 * these to the database or mix them into a real account's numbers.
 */
export const SAMPLE_BUSINESS_NAME = "Example Studio Co.";

export const SAMPLE_DASHBOARD = {
  cashOnHand: 72_000,
  monthlyRevenue: 25_000,
  monthlyExpenses: 18_000,
  accountsReceivable: 4_000,
  netProfit: 7_000,
  netCashFlow: 5_200,
  pl: [
    { label: "Total Income", value: 25_000 },
    { label: "Gross Profit", value: 16_500 },
    { label: "Total Expenses", value: 18_000 },
    { label: "Net Profit", value: 7_000 },
  ],
  incomeTrend: [
    { month: "Month 1", income: 19_500, expenses: 16_200 },
    { month: "Month 2", income: 21_000, expenses: 17_100 },
    { month: "Month 3", income: 20_400, expenses: 16_900 },
    { month: "Month 4", income: 22_800, expenses: 17_400 },
    { month: "Month 5", income: 23_600, expenses: 17_800 },
    { month: "Month 6", income: 25_000, expenses: 18_000 },
  ],
} as const;
