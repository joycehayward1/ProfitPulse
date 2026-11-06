import { normalizeMonthly } from "@/lib/financial-periods";
import { buildGoalBaseline, computeGoal } from "@/lib/goal-planning";
import { NOV_5_2026, sampleSnapshots, snapshot } from "@/lib/test-fixtures/sample-months";

describe("buildGoalBaseline", () => {
  it("uses saved months for revenue so far and the calendar for months left", () => {
    const b = buildGoalBaseline(normalizeMonthly(sampleSnapshots(), NOV_5_2026), NOV_5_2026);
    expect(b.year).toBe(2026);
    expect(b.revenueSoFar).toBe(70500);
    expect(b.expensesSoFar).toBe(57500);
    expect(b.source).toBe("saved_months");
    expect(b.coveredThrough).toBe("2026-04");
    expect(b.monthsElapsed).toBe(10);
    expect(b.monthsRemaining).toBe(2);
    expect(b.monthsElapsed + b.monthsRemaining).toBe(12);
    expect(b.missingMonths).toEqual(["2026-01"]);
    expect(b.unsavedPastMonths).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("builds a running total with month-on-month changes", () => {
    const b = buildGoalBaseline(normalizeMonthly(sampleSnapshots(), NOV_5_2026), NOV_5_2026);
    expect(b.months.map((m) => [m.month, m.income, m.cumulative])).toEqual([
      ["2026-01", null, 0],
      ["2026-02", 22000, 22000],
      ["2026-03", 23500, 45500],
      ["2026-04", 25000, 70500],
    ]);
    expect(b.months[1].changeFromPrevious).toBeNull();
    expect(b.months[3].changeFromPrevious).toBeCloseTo(6.383, 3);
  });

  it("starts fresh in January without last year's months", () => {
    const jan = new Date(2027, 0, 10);
    const b = buildGoalBaseline(normalizeMonthly(sampleSnapshots(), jan), jan);
    expect(b.year).toBe(2027);
    expect(b.source).toBe("none");
    expect(b.revenueSoFar).toBeNull();
    expect(b.monthsElapsed).toBe(0);
    expect(b.monthsRemaining).toBe(12);
    expect(b.unsavedPastMonths).toEqual([]);
  });

  it("counts the latest saved month as done when it is the current month", () => {
    const now = new Date(2026, 3, 20);
    const b = buildGoalBaseline(normalizeMonthly([snapshot("2026-04-30", 1000, 500)], now), now);
    expect(b.monthsElapsed).toBe(4);
    expect(b.monthsRemaining).toBe(8);
  });

  it("always leaves at least one month in December", () => {
    const now = new Date(2026, 11, 15);
    const b = buildGoalBaseline(normalizeMonthly([snapshot("2026-12-31", 1000, 500)], now), now);
    expect(b.monthsRemaining).toBe(1);
  });

  it("uses an entered year-to-date figure when months are missing", () => {
    const rows = [snapshot("2026-03-31", 10000, 8000, { ytd_revenue: 31000, ytd_expenses: 25000 })];
    const b = buildGoalBaseline(normalizeMonthly(rows, NOV_5_2026), NOV_5_2026);
    expect(b.source).toBe("entered_ytd");
    expect(b.revenueSoFar).toBe(31000);
    expect(b.expensesSoFar).toBe(25000);
  });

  it("prefers the saved months when all of them are there", () => {
    const rows = [
      snapshot("2026-01-31", 10000, 8000),
      snapshot("2026-02-28", 10000, 8000, { ytd_revenue: 99999 }),
    ];
    const b = buildGoalBaseline(normalizeMonthly(rows, NOV_5_2026), NOV_5_2026);
    expect(b.source).toBe("saved_months");
    expect(b.revenueSoFar).toBe(20000);
  });
});

describe("computeGoal", () => {
  const base = { annualGoal: 300000, monthlyRevenue: 23500, monthlyExpenses: 19166.67, ytdRevenue: 70500, ytdExpenses: 57500, monthsRemaining: 2 };

  it("spreads what's left of the goal over the months left", () => {
    const r = computeGoal(base);
    expect(r.monthsElapsed).toBe(10);
    expect(r.requiredMonthly).toBe(114750);
    expect(r.revenueSoFarSource).toBe("entered");
    expect(r.ytdProfit).toBe(13000);
    expect(r.progressPercent).toBeCloseTo(23.5, 5);
    expect(r.growthRequired).toBeCloseTo(388.297, 2);
    expect(r.status).toBe("critical");
  });

  it("never counts more than 12 months between done and left", () => {
    for (const monthsRemaining of [1, 2, 6, 12]) {
      const r = computeGoal({ ...base, monthsRemaining });
      expect(r.monthsElapsed + monthsRemaining).toBe(12);
    }
    expect(computeGoal({ ...base, monthsRemaining: 20 }).monthsElapsed).toBe(0);
    expect(computeGoal({ ...base, monthsRemaining: 0 }).monthsElapsed).toBe(11);
  });

  it("estimates year to date from the monthly figure when it isn't entered", () => {
    const r = computeGoal({ ...base, ytdRevenue: 0, ytdExpenses: 0, monthsRemaining: 8 });
    expect(r.monthsElapsed).toBe(4);
    expect(r.revenueSoFar).toBe(94000);
    expect(r.revenueSoFarSource).toBe("estimated");
    expect(r.expensesSoFar).toBeCloseTo(76666.68, 2);
    expect(r.expensesSoFarSource).toBe("estimated");
  });

  it("does not divide by zero when monthly revenue is zero", () => {
    const r = computeGoal({ ...base, monthlyRevenue: 0 });
    expect(r.growthRequired).toBeNull();
    expect(Number.isFinite(r.requiredMonthly)).toBe(true);
  });

  it("needs nothing more once the goal is reached", () => {
    const r = computeGoal({ ...base, ytdRevenue: 320000 });
    expect(r.requiredMonthly).toBe(0);
    expect(r.progressPercent).toBe(100);
    expect(r.status).toBe("healthy");
  });

  it("handles a loss year to date", () => {
    const r = computeGoal({ ...base, ytdRevenue: 40000, ytdExpenses: 55000 });
    expect(r.ytdProfit).toBe(-15000);
  });
});
