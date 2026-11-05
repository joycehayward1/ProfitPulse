import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GoalPlanningPage from "@/app/scenarios/goal-planning/page";
import BreakEvenPage from "@/app/scenarios/break-even/page";
import RunwayPage from "@/app/scenarios/runway/page";
import { createMockDatabase } from "@/lib/test-fixtures/mock-database";
import { freezeDate } from "@/lib/test-fixtures/clock";
import { NOV_5_2026, sampleSnapshots } from "@/lib/test-fixtures/sample-months";

jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock("@/lib/ai-insights", () => ({
  generateScenarioExplanation: jest.fn().mockResolvedValue("Sample explanation."),
}));

let mockDb = createMockDatabase({});
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: () => ({ database: mockDb.database }),
}));

beforeEach(() => {
  freezeDate(NOV_5_2026);
  mockDb = createMockDatabase({ financial_snapshots: sampleSnapshots(), scenarios: [] });
});

afterEach(() => jest.useRealTimers());

function input(label: string) {
  const el = screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input");
  return el as HTMLInputElement;
}

describe("Goal Planning", () => {
  async function renderLoaded() {
    render(<GoalPlanningPage />);
    await waitFor(() => expect(input("Year-to-date revenue").value).toBe("70500"));
  }

  it("pre-fills from saved months without rounding and says where each number came from", async () => {
    await renderLoaded();
    expect(input("Current monthly revenue").value).toBe("23500");
    expect(input("Current monthly expenses").value).toBe("19166.67");
    expect(input("Year-to-date expenses").value).toBe("57500");
    expect(screen.getAllByText(/Pre-filled with your average of February–April 2026 \(3 months\)/)).toHaveLength(2);
    expect(screen.getAllByText(/Added up from your saved months, January–April 2026/)).toHaveLength(2);
  });

  it("counts months on the calendar so done and left add up to 12", async () => {
    await renderLoaded();
    expect(input("Months remaining in fiscal year").value).toBe("2");
    expect(screen.getByText(/10 of 12 months done, 2 left including this one/)).toBeInTheDocument();
  });

  it("warns about missing and unsaved months", async () => {
    await renderLoaded();
    const coverage = screen.getByTestId("ytd-coverage");
    expect(coverage).toHaveTextContent("January 2026 isn't saved");
    expect(coverage).toHaveTextContent("May–October 2026 are over but not saved yet");
    expect(coverage).toHaveTextContent("runs through April 2026");
  });

  it("shows each month with a running total and change from the month before", async () => {
    await renderLoaded();
    const rows = within(screen.getByTestId("goal-months")).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      "January 2026Not saved—$0",
      "February 2026$22,000—$22,000",
      "March 2026$23,500▲ 6.8%$45,500",
      "April 2026$25,000▲ 6.4%$70,500",
    ]);
  });

  it("works out the monthly target over the two months left", async () => {
    await renderLoaded();
    fireEvent.change(input("Annual revenue goal"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate Monthly Target" }));
    expect(await screen.findAllByText("$114,750")).toHaveLength(2);
    expect(screen.getByText(/for the next/)).toHaveTextContent("for the next 2 months");
  });

  it("saves the year-to-date figures as entered and labels estimates", async () => {
    await renderLoaded();
    fireEvent.change(input("Annual revenue goal"), { target: { value: "300000" } });
    fireEvent.change(input("Year-to-date revenue"), { target: { value: "" } });
    fireEvent.change(input("Year-to-date expenses"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate Monthly Target" }));
    expect(await screen.findAllByText("Estimate: monthly × 10 months")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Save Scenario" }));
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const [saved] = mockDb.writes[0].payload as Array<{ inputs: Record<string, unknown>; result: Record<string, unknown> }>;
    expect(saved.inputs).toMatchObject({ annualGoal: 300000, ytdRevenue: null, ytdExpenses: null, monthsRemaining: 2 });
    expect(saved.result).toMatchObject({ revenueSoFar: 235000, revenueSoFarSource: "estimated", monthsElapsed: 10 });
  });

  it("stores typed year-to-date figures exactly", async () => {
    await renderLoaded();
    fireEvent.change(input("Annual revenue goal"), { target: { value: "300000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate Monthly Target" }));
    await screen.findAllByText("$114,750");
    fireEvent.click(screen.getByRole("button", { name: "Save Scenario" }));
    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const [saved] = mockDb.writes[0].payload as Array<{ inputs: Record<string, unknown>; result: Record<string, unknown> }>;
    expect(saved.inputs).toMatchObject({ ytdRevenue: 70500, ytdExpenses: 57500 });
    expect(saved.result).toMatchObject({ requiredMonthly: 114750, revenueSoFarSource: "entered", ytdProfit: 13000 });
  });
});

describe("Break-Even", () => {
  it("pre-fills fixed costs from the recent monthly average and names the months", async () => {
    render(<BreakEvenPage />);
    await waitFor(() => expect(input("Monthly Fixed Expenses").value).toBe("19166.67"));
    expect(screen.getByTestId("fixed-source")).toHaveTextContent(
      "Pre-filled with your total monthly expenses, average of February–April 2026 (3 months)"
    );
    expect(screen.getByText(/\$23,500, average of February–April 2026/)).toBeInTheDocument();
  });

  it("estimates monthly units from monthly revenue at the entered price", async () => {
    render(<BreakEvenPage />);
    await waitFor(() => expect(input("Monthly Fixed Expenses").value).toBe("19166.67"));
    fireEvent.change(input("Average Price per Service/Product"), { target: { value: "150" } });
    fireEvent.change(input("Variable Cost per Service/Product"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate Break-Even Point" }));
    expect(await screen.findByText("192")).toBeInTheDocument();
    expect(screen.getByText("157 units")).toBeInTheDocument();
  });
});

describe("Cash Runway", () => {
  it("uses cash as of the latest month and the average monthly burn", async () => {
    render(<RunwayPage />);
    await waitFor(() => expect(input("Current cash on hand").value).toBe("44000"));
    expect(input("Monthly burn rate").value).toBe("19166.67");
    expect(screen.getByTestId("cash-source")).toHaveTextContent("as of April 2026 (a balance, not added up across months)");
    expect(screen.getByTestId("burn-source")).toHaveTextContent("average of February–April 2026 (3 months)");
    fireEvent.click(screen.getByRole("button", { name: "Calculate Runway" }));
    expect(await screen.findByText("2.3")).toBeInTheDocument();
  });
});
