import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import PLPage from "@/app/reports/pl/page";
import CashFlowPage from "@/app/reports/cashflow/page";
import BalanceSheetPage from "@/app/reports/balance-sheet/page";
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

beforeEach(() => {
  freezeDate(NOV_5_2026);
  mockDb = createMockDatabase({ financial_snapshots: sampleSnapshots() });
});

afterEach(() => jest.useRealTimers());

function kpi(label: string) {
  return screen.getByText(label, { selector: "p" }).parentElement as HTMLElement;
}

function choosePeriod(current: string, next: string) {
  fireEvent.click(screen.getByRole("button", { name: current }));
  fireEvent.click(screen.getByRole("button", { name: next }));
}

describe("P&L report", () => {
  it("counts periods back from the latest saved month, not from today", async () => {
    render(<PLPage />);
    expect(await screen.findByTestId("pl-range")).toHaveTextContent("Showing February–April 2026 · 3 of 3 months saved");
    expect(kpi("Total Income")).toHaveTextContent("$70,500");
    expect(screen.queryByText("No data for this period")).not.toBeInTheDocument();
  });

  it("offers year to date with the months it covers and the missing one", async () => {
    render(<PLPage />);
    await screen.findByTestId("pl-range");
    choosePeriod("Last 3 Months", "Year to Date");
    const range = screen.getByTestId("pl-range");
    expect(range).toHaveTextContent("January–April 2026 (year to date) · 3 of 4 months saved");
    expect(range).toHaveTextContent(
      "not compared with the year before: January–April 2025 has 1 of 4 months saved, not the same months as January–April 2026"
    );
    expect(within(kpi("Total Income")).queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByTestId("pl-missing")).toHaveTextContent("Not saved: January 2026");
    expect(kpi("Total Income")).toHaveTextContent("$70,500");
    expect(kpi("Total Expenses")).toHaveTextContent("$57,500");
    expect(kpi("Net Profit")).toHaveTextContent("$13,000");
  });

  it("spans a year boundary without leaking future months", async () => {
    render(<PLPage />);
    await screen.findByTestId("pl-range");
    choosePeriod("Last 3 Months", "Last 6 Months");
    expect(screen.getByTestId("pl-range")).toHaveTextContent("November 2025–April 2026 · 4 of 6 months saved");
    expect(kpi("Total Income")).toHaveTextContent("$94,500");
    expect(screen.getByText(/dated in the future: June 2027/)).toBeInTheDocument();
  });

  it("compares the latest month with March and shows the expense rise in red", async () => {
    render(<PLPage />);
    await screen.findByTestId("pl-range");
    choosePeriod("Last 3 Months", "Latest Month");
    expect(kpi("Total Income")).toHaveTextContent("$25,000");
    expect(within(kpi("Total Income")).getByText(/6\.4%/)).toHaveClass("text-success");
    expect(within(kpi("Total Expenses")).getByText(/13\.5%/)).toHaveClass("text-error");
    expect(within(kpi("Total Expenses")).getByText("vs Mar 26")).toBeInTheDocument();
  });

  it("works out margins from the totals, as a percentage", async () => {
    render(<PLPage />);
    await screen.findByTestId("pl-range");
    expect(screen.getByRole("heading", { name: "P&L Summary — April 2026" })).toBeInTheDocument();
    const row = screen.getByText("Net Profit Margin %").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("16.0%");
    expect(row).toHaveTextContent("21.3%");
    const expenses = screen.getByText("Total Expenses", { selector: "span" }).closest("tr") as HTMLElement;
    expect(within(expenses).getAllByText(/13\.5%|31\.3%/).every((el) => el.className.includes("text-error"))).toBe(true);
  });
});

describe("Cash flow report", () => {
  it("adds up flows for the year to date and shows cash as of the month", async () => {
    render(<CashFlowPage />);
    const ytd = await screen.findByTestId("cashflow-ytd");
    expect(ytd).toHaveTextContent("January–April 2026 · 3 of 4 months saved · not saved: January 2026");
    expect(ytd).toHaveTextContent("Operating$8,000");
    expect(ytd).toHaveTextContent("Investing-$2,000");
    expect(ytd).toHaveTextContent("Financing—");
    expect(ytd).toHaveTextContent("Net cash flow$6,000");
    expect(screen.getByTestId("cashflow-cash-asof")).toHaveTextContent("Cash on hand as of April 2026: $44,000");
  });

  it("lists each month once and compares with the calendar month before", async () => {
    render(<CashFlowPage />);
    await screen.findByTestId("cashflow-ytd");
    const options = within(screen.getByRole("combobox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["April 2026", "March 2026", "February 2026", "December 2025", "April 2025"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-03" } });
    expect(screen.getByTestId("cashflow-ytd")).toHaveTextContent("January–March 2026");
    expect(screen.getByTestId("cashflow-cash-asof")).toHaveTextContent("as of March 2026: $42,500");
  });
});

describe("Balance sheet", () => {
  it("shows balances as of the month, without duplicate or future periods", async () => {
    render(<BalanceSheetPage />);
    expect(await screen.findByText("As of April 2026")).toBeInTheDocument();
    const options = within(screen.getByRole("combobox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["April 2026", "March 2026", "February 2026", "December 2025", "April 2025"]);
    expect(screen.getByText("Apr 25")).toBeInTheDocument();
    const assets = screen.getByText("Current Assets").closest("tr") as HTMLElement;
    expect(assets).toHaveTextContent("$44,000");
    expect(assets).toHaveTextContent("$30,000");
  });
});
