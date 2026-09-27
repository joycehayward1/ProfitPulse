import {
  calculateHabitsScore,
  describePainPoints,
  getFocusAreas,
  getRealityChecks,
  RATING_QUESTIONS,
  type FinancialContext,
  type Ratings,
} from "../self-assessment";

function allRatings(value: number): Ratings {
  return Object.fromEntries(RATING_QUESTIONS.map((q) => [q.id, value])) as Ratings;
}

const baseContext: FinancialContext = {
  cashOnHand: 20000,
  monthlyRevenue: 10000,
  monthlyExpenses: 8000,
  netProfit: 2000,
  totalLiabilities: null,
  incomeHistory: [],
};

describe("calculateHabitsScore", () => {
  it("maps all 1s to 0 and all 5s to 100", () => {
    expect(calculateHabitsScore(allRatings(1))).toBe(0);
    expect(calculateHabitsScore(allRatings(5))).toBe(100);
  });

  it("maps all 3s to 50", () => {
    expect(calculateHabitsScore(allRatings(3))).toBe(50);
  });
});

describe("describePainPoints", () => {
  it("uses labels and substitutes the Other text", () => {
    expect(describePainPoints(["cash_flow", "other"], "Late-paying clients")).toBe(
      "Cash flow is unpredictable; Other: Late-paying clients"
    );
  });
});

describe("getFocusAreas", () => {
  it("returns one focus area per pain point, capped at 3", () => {
    const areas = getFocusAreas(
      { pain_points: ["cash_flow", "pricing", "expenses", "debt"], pain_point_other: null },
      baseContext
    );
    expect(areas.map((a) => a.painPoint)).toEqual(["cash_flow", "pricing", "expenses"]);
  });

  it("shows runway months unless runway is locked", () => {
    const [open] = getFocusAreas({ pain_points: ["cash_flow"], pain_point_other: null }, baseContext);
    expect(open.detail).toContain("2.5 months");

    const [locked] = getFocusAreas(
      { pain_points: ["cash_flow"], pain_point_other: null },
      { ...baseContext, runwayLocked: true }
    );
    expect(locked.detail).not.toMatch(/\d months/);
  });

  it("reports the revenue trend when history exists", () => {
    const [area] = getFocusAreas(
      { pain_points: ["revenue_stagnant"], pain_point_other: null },
      { ...baseContext, incomeHistory: [10000, 9000, 8000] }
    );
    expect(area.detail).toContain("down 20%");
  });
});

describe("getRealityChecks", () => {
  it("flags a loss when the owner rated profitability highly", () => {
    const checks = getRealityChecks(allRatings(5), { ...baseContext, netProfit: -1500 });
    expect(checks[0].tone).toBe("caution");
    expect(checks[0].message).toContain("$1,500");
  });

  it("reassures an owner who underrates a profitable business", () => {
    const checks = getRealityChecks(allRatings(1), { ...baseContext, cashOnHand: 40000 });
    expect(checks.map((c) => c.tone)).toEqual(["positive", "positive"]);
  });

  it("stays quiet when ratings roughly match the numbers", () => {
    expect(getRealityChecks(allRatings(3), baseContext)).toEqual([]);
  });

  it("skips the cash-reserve check when runway is locked", () => {
    const checks = getRealityChecks(allRatings(5), { ...baseContext, runwayLocked: true });
    expect(checks).toEqual([]);
  });
});
