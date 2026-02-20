import { render, screen } from "@testing-library/react";
import { HealthScoreGauge, getScoreColor } from "../HealthScoreGauge";

describe("HealthScoreGauge", () => {
  it("renders the score number", () => {
    render(<HealthScoreGauge score={85} />);
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("has accessible label with score", () => {
    render(<HealthScoreGauge score={72} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Health score: 72 out of 100"
    );
  });

  it("clamps score to 0-100 range", () => {
    const { rerender } = render(<HealthScoreGauge score={150} />);
    expect(screen.getByText("100")).toBeInTheDocument();

    rerender(<HealthScoreGauge score={-20} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("getScoreColor", () => {
  it("returns green for scores 80-100", () => {
    expect(getScoreColor(80)).toBe("#43A047");
    expect(getScoreColor(100)).toBe("#43A047");
    expect(getScoreColor(95)).toBe("#43A047");
  });

  it("returns amber for scores 50-79", () => {
    expect(getScoreColor(50)).toBe("#F9A825");
    expect(getScoreColor(79)).toBe("#F9A825");
    expect(getScoreColor(65)).toBe("#F9A825");
  });

  it("returns red for scores 0-49", () => {
    expect(getScoreColor(0)).toBe("#D32F2F");
    expect(getScoreColor(49)).toBe("#D32F2F");
    expect(getScoreColor(25)).toBe("#D32F2F");
  });
});
