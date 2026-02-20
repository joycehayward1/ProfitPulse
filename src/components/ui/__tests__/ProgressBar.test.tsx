import { render, screen } from "@testing-library/react";
import { ProgressBar } from "../ProgressBar";

describe("ProgressBar", () => {
  it("renders with progressbar role", () => {
    render(<ProgressBar value={50} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
  });

  it("sets correct aria attributes", () => {
    render(<ProgressBar value={30} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("displays label when provided", () => {
    render(<ProgressBar value={50} max={100} label="Revenue Goal" />);
    expect(screen.getByText("Revenue Goal")).toBeInTheDocument();
  });

  it("displays percentage when showPercentage is true", () => {
    render(<ProgressBar value={75} max={100} showPercentage />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("does not display percentage by default", () => {
    render(<ProgressBar value={75} max={100} />);
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  it("clamps percentage to 0-100", () => {
    render(<ProgressBar value={200} max={100} showPercentage />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
