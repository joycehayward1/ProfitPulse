import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders 'Healthy' text for healthy status", () => {
    render(<StatusBadge status="healthy" />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
  });

  it("renders 'Attention' text for attention status", () => {
    render(<StatusBadge status="attention" />);
    expect(screen.getByText("Attention")).toBeInTheDocument();
  });

  it("renders 'Critical' text for critical status", () => {
    render(<StatusBadge status="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("applies green styling for healthy", () => {
    render(<StatusBadge status="healthy" />);
    const badge = screen.getByText("Healthy");
    expect(badge.className).toContain("text-success");
  });

  it("applies red styling for critical", () => {
    render(<StatusBadge status="critical" />);
    const badge = screen.getByText("Critical");
    expect(badge.className).toContain("text-error");
  });

  it("has pill shape with rounded-full", () => {
    render(<StatusBadge status="healthy" />);
    const badge = screen.getByText("Healthy");
    expect(badge.className).toContain("rounded-full");
  });
});
