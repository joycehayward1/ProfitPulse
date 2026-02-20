import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with a label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("shows required indicator when required", () => {
    render(<Input label="Name" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows error message and sets aria-invalid", () => {
    render(<Input label="Revenue" error="Revenue is required" />);
    const input = screen.getByLabelText("Revenue");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Revenue is required");
  });

  it("shows helper text when no error", () => {
    render(<Input label="Email" helperText="We won't share this" />);
    expect(screen.getByText("We won't share this")).toBeInTheDocument();
  });

  it("hides helper text when error is present", () => {
    render(<Input label="Email" helperText="Helper" error="Error!" />);
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
  });

  it("applies error border styles", () => {
    render(<Input label="Test" error="Bad" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-error");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Input label="Test" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("calls onChange handler", () => {
    const handleChange = jest.fn();
    render(<Input label="Test" onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(handleChange).toHaveBeenCalled();
  });
});
