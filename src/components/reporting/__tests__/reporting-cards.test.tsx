import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChangeBadge } from "@/components/reporting/ChangeBadge";
import { LatestMonthCard } from "@/components/reporting/LatestMonthCard";
import { YearToDateCard } from "@/components/reporting/YearToDateCard";
import { normalizeMonthly } from "@/lib/financial-periods";
import { NOV_5_2026, sampleSnapshots, snapshot } from "@/lib/test-fixtures/sample-months";

const data = () => normalizeMonthly(sampleSnapshots(), NOV_5_2026);

function rowFor(label: string) {
  return screen.getByText(label).closest("tr") as HTMLElement;
}

describe("ChangeBadge", () => {
  it("shows a rise in expenses in red and a rise in income in green", () => {
    const { rerender } = render(<ChangeBadge change={13.5} higherIsBetter={false} />);
    expect(screen.getByText(/13\.5%/)).toHaveClass("text-error");
    rerender(<ChangeBadge change={6.4} higherIsBetter />);
    expect(screen.getByText(/6\.4%/)).toHaveClass("text-success");
  });

  it("shows a dash when there is nothing to compare", () => {
    render(<ChangeBadge change={null} higherIsBetter />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("LatestMonthCard", () => {
  it("labels the latest saved month instead of calling it the current period", () => {
    render(<LatestMonthCard data={data()} />);
    expect(screen.getByRole("heading", { name: /latest saved month — april 2026/i })).toBeInTheDocument();
    expect(screen.queryByText(/current period/i)).not.toBeInTheDocument();
  });

  it("compares with March 2026 and colours the expense rise red", () => {
    render(<LatestMonthCard data={data()} />);
    expect(screen.getByText("vs Mar 26")).toBeInTheDocument();
    const income = within(rowFor("Total Income"));
    expect(income.getByText("$25,000")).toBeInTheDocument();
    expect(income.getByText(/6\.4%/)).toHaveAttribute("data-tone", "good");
    const expenses = within(rowFor("Total Expenses"));
    expect(expenses.getByText(/13\.5%/)).toHaveAttribute("data-tone", "bad");
    const net = within(rowFor("Net Profit"));
    expect(net.getByText(/20\.0%/)).toHaveAttribute("data-tone", "bad");
  });

  it("compares with the same month last year", () => {
    render(<LatestMonthCard data={data()} />);
    expect(screen.getByText("vs Apr 25")).toBeInTheDocument();
    expect(within(rowFor("Total Income")).getByText(/25\.0%/)).toBeInTheDocument();
  });

  it("explains duplicates and future-dated months", () => {
    render(<LatestMonthCard data={data()} />);
    const notes = screen.getByTestId("latest-month-notes");
    expect(notes).toHaveTextContent("April 2026 was saved 2 times; the most recent save is used.");
    expect(notes).toHaveTextContent("June 2027");
  });

  it("says when the month before wasn't saved", () => {
    const sparse = normalizeMonthly([snapshot("2026-01-31", 1000, 900), snapshot("2026-03-31", 1200, 800)], NOV_5_2026);
    render(<LatestMonthCard data={sparse} />);
    expect(screen.getByTestId("latest-month-notes")).toHaveTextContent("February 2026 isn't saved");
    expect(within(rowFor("Total Income")).getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("YearToDateCard", () => {
  it("adds up January–April 2026 and says January is missing", () => {
    render(<YearToDateCard data={data()} />);
    expect(screen.getByTestId("ytd-range")).toHaveTextContent("January–April 2026 · 3 of 4 months saved");
    expect(screen.getByTestId("ytd-missing")).toHaveTextContent("Not saved yet: January 2026");
    expect(screen.getByTestId("ytd-income")).toHaveTextContent("$70,500");
    expect(screen.getByTestId("ytd-expenses")).toHaveTextContent("$57,500");
    expect(screen.getByTestId("ytd-net")).toHaveTextContent("$13,000");
    expect(screen.getByTestId("ytd-net")).toHaveTextContent("Margin 18.4%");
  });

  it("shows cash as of April instead of adding up the months", () => {
    render(<YearToDateCard data={data()} />);
    const cash = screen.getByTestId("ytd-cash");
    expect(cash).toHaveTextContent("$44,000");
    expect(cash).toHaveTextContent("as of April 2026");
    expect(cash).not.toHaveTextContent("$127,500");
  });

  it("doesn't show a percentage against last year when different months are saved", () => {
    render(<YearToDateCard data={data()} />);
    expect(screen.getByTestId("ytd-prior")).toHaveTextContent(
      "Not compared with 2025: January–April 2025 has 1 of 4 months saved, not the same months as January–April 2026."
    );
    expect(screen.getByTestId("ytd-income")).not.toHaveTextContent("vs 2025");
  });

  it("switches years without mixing them", () => {
    render(<YearToDateCard data={data()} />);
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2025" } });
    expect(screen.getByTestId("ytd-range")).toHaveTextContent("January–December 2025 · 2 of 12 months saved");
    expect(screen.getByTestId("ytd-income")).toHaveTextContent("$44,000");
    expect(screen.getByTestId("ytd-cash")).toHaveTextContent("as of December 2025");
  });

  it("points out when an entered year-to-date figure differs from the saved months", () => {
    const rows = [snapshot("2026-03-31", 10000, 8000, { ytd_revenue: 31000 })];
    render(<YearToDateCard data={normalizeMonthly(rows, NOV_5_2026)} />);
    expect(screen.getByTestId("ytd-stated")).toHaveTextContent("You entered $31,000 as year-to-date revenue for March 2026");
  });
});
