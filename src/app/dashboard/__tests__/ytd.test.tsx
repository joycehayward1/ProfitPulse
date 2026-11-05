import React from "react";
import { render, screen } from "@testing-library/react";
import DashboardPage from "../page";
import { createMockDatabase } from "@/lib/test-fixtures/mock-database";
import { freezeDate } from "@/lib/test-fixtures/clock";
import { NOV_5_2026, sampleSnapshots } from "@/lib/test-fixtures/sample-months";

jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let mockDb = createMockDatabase({});
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({ database: mockDb.database }),
}));

const assessment = {
  id: "sample-assessment",
  user_id: "test-user",
  cash_on_hand: 44000,
  monthly_revenue: 25000,
  monthly_expenses: 21000,
  accounts_receivable: 3000,
  employee_count: 4,
  biggest_worry: null,
  health_score: 0,
  ai_summary: null,
  recommendations: null,
  created_at: "2026-05-04T15:00:00Z",
};

beforeEach(() => {
  freezeDate(NOV_5_2026);
  window.localStorage.clear();
  window.localStorage.setItem("profitpulse_tour_test-user", "done");
  mockDb = createMockDatabase({
    health_assessments: [assessment],
    financial_snapshots: sampleSnapshots(),
    self_assessments: [],
  });
});

afterEach(() => jest.useRealTimers());

describe("Dashboard with several saved months", () => {
  it("labels the latest saved month instead of calling it current", async () => {
    render(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Latest saved month — April 2026" })).toBeInTheDocument();
    expect(screen.queryByText(/Current Period/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("vs Mar 26").length).toBeGreaterThan(0);
  });

  it("shows January-to-date totals with honest coverage and cash as of April", async () => {
    render(<DashboardPage />);
    expect(await screen.findByTestId("ytd-range")).toHaveTextContent("January–April 2026 · 3 of 4 months saved");
    expect(screen.getByTestId("ytd-missing")).toHaveTextContent("January 2026");
    expect(screen.getByTestId("ytd-income")).toHaveTextContent("$70,500");
    expect(screen.getByTestId("ytd-expenses")).toHaveTextContent("$57,500");
    expect(screen.getByTestId("ytd-net")).toHaveTextContent("$13,000");
    expect(screen.getByTestId("ytd-cash")).toHaveTextContent("$44,000");
    expect(screen.getByTestId("ytd-cash")).toHaveTextContent("as of April 2026");
  });

  it("titles the income trend with the months it covers", async () => {
    render(<DashboardPage />);
    const trend = await screen.findByTestId("income-trend");
    expect(trend).toHaveTextContent("May 2025–April 2026");
  });
});
