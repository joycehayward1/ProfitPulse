import { render, screen, fireEvent } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies standard variant styles by default", () => {
    render(<Card>Standard</Card>);
    const card = screen.getByText("Standard").closest("div")!;
    expect(card.className).toContain("bg-surface");
  });

  it("applies featured variant with orange border", () => {
    render(<Card variant="featured">Featured</Card>);
    const card = screen.getByText("Featured").closest("div")!;
    expect(card.className).toContain("border-l-orange");
  });

  it("applies highlight variant with inset surface", () => {
    render(<Card variant="highlight">Highlight</Card>);
    const card = screen.getByText("Highlight").closest("div")!;
    expect(card.className).toContain("bg-surface-inset");
  });

  it("is clickable and responds to click events", () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Clickable</Card>);
    const card = screen.getByRole("button");
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("responds to Enter key when clickable", () => {
    const handleClick = jest.fn();
    render(<Card onClick={handleClick}>Clickable</Card>);
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not have button role when not clickable", () => {
    render(<Card>Static</Card>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("accepts custom className", () => {
    render(<Card className="mt-4">Custom</Card>);
    const card = screen.getByText("Custom").closest("div")!;
    expect(card.className).toContain("mt-4");
  });
});
