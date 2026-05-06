import { render, screen } from "@testing-library/react";
import { HealthScoreGauge, getScoreColor } from "../HealthScoreGauge";

describe("HealthScoreGauge", () => {
  it("renders the score number", () => {
    render(<HealthScoreGauge score={85} animate={false} />);
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
    const { rerender } = render(<HealthScoreGauge score={150} animate={false} />);
    expect(screen.getByText("100")).toBeInTheDocument();

    rerender(<HealthScoreGauge score={-20} animate={false} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});

describe("getScoreColor", () => {
  it("returns green for scores 80-100", () => {
    expect(getScoreColor(80)).toBe("#16A34A");
    expect(getScoreColor(100)).toBe("#16A34A");
    expect(getScoreColor(95)).toBe("#16A34A");
  });

  it("returns orange for scores 60-79", () => {
    expect(getScoreColor(60)).toBe("#E65100");
    expect(getScoreColor(79)).toBe("#E65100");
    expect(getScoreColor(65)).toBe("#E65100");
  });

  it("returns amber for scores 40-59", () => {
    expect(getScoreColor(40)).toBe("#D97706");
    expect(getScoreColor(59)).toBe("#D97706");
  });

  it("returns red for scores 0-39", () => {
    expect(getScoreColor(0)).toBe("#DC2626");
    expect(getScoreColor(39)).toBe("#DC2626");
    expect(getScoreColor(25)).toBe("#DC2626");
  });
});
