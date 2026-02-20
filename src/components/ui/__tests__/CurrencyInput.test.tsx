import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrencyInput } from "../CurrencyInput";

describe("CurrencyInput", () => {
  it("renders with label", () => {
    render(<CurrencyInput label="Amount" />);
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("shows required asterisk when required", () => {
    render(<CurrencyInput label="Amount" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("formats currency with commas", () => {
    const onChange = jest.fn();
    render(<CurrencyInput onChange={onChange} placeholder="0.00" />);

    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "12345.67" } });

    // Display value should be formatted
    expect(input).toHaveValue("12,345.67");
    // Raw value passed to onChange should be unformatted
    expect(onChange).toHaveBeenCalledWith("12345.67");
  });

  it("handles large numbers with multiple commas", () => {
    const onChange = jest.fn();
    render(<CurrencyInput onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1234567.89" } });

    expect(input).toHaveValue("1,234,567.89");
    expect(onChange).toHaveBeenCalledWith("1234567.89");
  });

  it("limits decimal places to 2", () => {
    const onChange = jest.fn();
    render(<CurrencyInput onChange={onChange} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "123.456789" } });

    expect(input).toHaveValue("123.45");
  });

  it("handles empty value", () => {
    const onChange = jest.fn();
    render(<CurrencyInput onChange={onChange} value="100" />);

    const input = screen.getByRole("textbox");
    // Clear the input (from "100" to "")
    fireEvent.change(input, { target: { value: "" } });

    expect(input).toHaveValue("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows error message when error prop is provided", () => {
    render(<CurrencyInput error="This field is required" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("shows helper text when provided and no error", () => {
    render(<CurrencyInput helperText="Enter the amount in USD" />);
    expect(screen.getByText("Enter the amount in USD")).toBeInTheDocument();
  });

  it("applies error styles when error is present", () => {
    render(<CurrencyInput error="Invalid" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-error");
  });

  it("shows dollar sign prefix", () => {
    const { container } = render(<CurrencyInput />);
    expect(container.textContent).toContain("$");
  });

  it("accepts external value prop", () => {
    render(<CurrencyInput value="5000" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("5,000");
  });

  it("can be disabled", () => {
    render(<CurrencyInput disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
