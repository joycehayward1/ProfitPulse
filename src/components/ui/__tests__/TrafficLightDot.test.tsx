import { render, screen } from "@testing-library/react";
import { TrafficLightDot } from "../TrafficLightDot";

describe("TrafficLightDot", () => {
  it("renders with label text", () => {
    render(<TrafficLightDot status="healthy" label="Profit" />);
    expect(screen.getByText("Profit")).toBeInTheDocument();
  });

  it("renders without label", () => {
    const { container } = render(<TrafficLightDot status="attention" />);
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("applies correct color class for healthy", () => {
    const { container } = render(<TrafficLightDot status="healthy" />);
    const dot = container.querySelector(".bg-success");
    expect(dot).toBeInTheDocument();
  });

  it("applies correct color class for attention", () => {
    const { container } = render(<TrafficLightDot status="attention" />);
    const dot = container.querySelector(".bg-warning");
    expect(dot).toBeInTheDocument();
  });

  it("applies correct color class for critical", () => {
    const { container } = render(<TrafficLightDot status="critical" />);
    const dot = container.querySelector(".bg-error");
    expect(dot).toBeInTheDocument();
  });

  it("shows pulse animation for critical status by default", () => {
    const { container } = render(<TrafficLightDot status="critical" />);
    const pulseEl = container.querySelector(".animate-ping");
    expect(pulseEl).toBeInTheDocument();
  });

  it("does not show pulse for healthy status by default", () => {
    const { container } = render(<TrafficLightDot status="healthy" />);
    const pulseEl = container.querySelector(".animate-ping");
    expect(pulseEl).not.toBeInTheDocument();
  });
});
