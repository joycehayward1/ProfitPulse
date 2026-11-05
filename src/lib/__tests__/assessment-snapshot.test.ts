import { buildAssessmentSnapshot } from "@/lib/assessment-snapshot";

const base = {
  userId: "user-1",
  now: new Date(2026, 10, 5),
  source: "manual" as const,
  revenue: 25000,
  expenses: 21000,
  cash: 44000,
  payables: 6000,
  ytdRevenue: 0,
  ytdExpenses: 0,
};

describe("buildAssessmentSnapshot", () => {
  it("saves the entered year-to-date figures with the month", () => {
    const row = buildAssessmentSnapshot({ ...base, ytdRevenue: 240000, ytdExpenses: 200000 });
    expect(row).toMatchObject({
      period_date: "2026-11-01",
      total_income: 25000,
      net_profit: 4000,
      ytd_revenue: 240000,
      ytd_expenses: 200000,
    });
  });

  it("leaves year-to-date fields out when they were left blank", () => {
    const row = buildAssessmentSnapshot(base);
    expect(row).not.toHaveProperty("ytd_revenue");
    expect(row).not.toHaveProperty("ytd_expenses");
  });

  it("dates the row by local month, including on the last evening of a month", () => {
    const row = buildAssessmentSnapshot({ ...base, now: new Date(2026, 11, 31, 23, 30) });
    expect(row.period_date).toBe("2026-12-01");
  });
});
