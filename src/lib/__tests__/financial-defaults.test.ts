import { deriveFinancialDefaults, loadFinancialDefaults } from "@/lib/financial-defaults";
import { NOV_5_2026, sampleSnapshots, snapshot } from "@/lib/test-fixtures/sample-months";

const mockFrom = jest.fn();
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({ database: { from: mockFrom } }),
}));

interface QueryChain {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
}

function query(rows: unknown[]): QueryChain {
  const chain: QueryChain = {
    select: jest.fn((): QueryChain => chain),
    eq: jest.fn((): QueryChain => chain),
    order: jest.fn((): QueryChain => chain),
    limit: jest.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return chain;
}

describe("deriveFinancialDefaults", () => {
  it("uses a recent monthly average, never a year-to-date total, and says which months", () => {
    const d = deriveFinancialDefaults(sampleSnapshots(), null, NOV_5_2026);
    expect(d.sourceKind).toBe("saved_months");
    expect(d.monthlyRevenue.value).toBe(23500);
    expect(d.monthlyExpenses.value).toBeCloseTo(19166.6667, 3);
    expect(d.monthlyExpenses.source).toBe("average of February–April 2026 (3 months)");
  });

  it("reads cash as of the latest month instead of adding it up", () => {
    const d = deriveFinancialDefaults(sampleSnapshots(), null, NOV_5_2026);
    expect(d.cash).toEqual({ value: 44000, source: "as of April 2026" });
  });

  it("ignores future-dated months and the superseded save", () => {
    const d = deriveFinancialDefaults(sampleSnapshots(), null, NOV_5_2026);
    expect(d.monthly.futureMonths).toEqual(["2027-06"]);
    expect(d.goal.revenueSoFar).toBe(70500);
  });

  it("falls back to the health check answers when nothing is saved", () => {
    const d = deriveFinancialDefaults(
      [],
      { monthly_revenue: 12000, monthly_expenses: 9000, cash_on_hand: 15000, ytd_revenue: 100000, ytd_expenses: 80000 },
      NOV_5_2026
    );
    expect(d.sourceKind).toBe("assessment");
    expect(d.monthlyRevenue).toEqual({ value: 12000, source: "from your health check answers" });
    expect(d.cash.value).toBe(15000);
    expect(d.goal.revenueSoFar).toBe(100000);
    expect(d.goal.source).toBe("entered_ytd");
    expect(d.goal.monthsRemaining).toBe(2);
  });

  it("returns empty figures when there is nothing at all", () => {
    const d = deriveFinancialDefaults([], null, NOV_5_2026);
    expect(d.sourceKind).toBe("none");
    expect(d.monthlyRevenue.value).toBeNull();
    expect(d.goal.source).toBe("none");
  });
});

describe("loadFinancialDefaults", () => {
  beforeEach(() => mockFrom.mockReset());

  it("loads enough months for a full year and skips the assessment when months exist", async () => {
    const snaps = query(sampleSnapshots());
    mockFrom.mockImplementation((table: string) => (table === "financial_snapshots" ? snaps : query([])));
    const d = await loadFinancialDefaults("user-1", NOV_5_2026);
    expect(snaps.limit).toHaveBeenCalledWith(120);
    expect(mockFrom).not.toHaveBeenCalledWith("health_assessments");
    expect(d.monthlyRevenue.value).toBe(23500);
  });

  it("falls back to the assessment when the only saved months are in the future", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "financial_snapshots"
        ? query([snapshot("2027-01-31", 1, 1)])
        : query([{ monthly_revenue: 5000, monthly_expenses: 4000, cash_on_hand: 2000 }])
    );
    const d = await loadFinancialDefaults("user-1", NOV_5_2026);
    expect(d.sourceKind).toBe("assessment");
    expect(d.monthlyRevenue.value).toBe(5000);
  });
});
