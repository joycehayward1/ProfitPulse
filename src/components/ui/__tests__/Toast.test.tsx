/**
 * Tests for the Toast component.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

// Helper component that triggers toasts
function ToastTrigger() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("success", "Operation successful!")}>
        Show Success
      </button>
      <button onClick={() => showToast("error", "Something went wrong!")}>
        Show Error
      </button>
      <button onClick={() => showToast("info", "Here is some info")}>
        Show Info
      </button>
    </div>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a success toast", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Success"));

    expect(screen.getByText("Operation successful!")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows an error toast", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Error"));

    expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
  });

  it("shows an info toast", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Info"));

    expect(screen.getByText("Here is some info")).toBeInTheDocument();
  });

  it("dismisses toast on click", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Success"));
    expect(screen.getByText("Operation successful!")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss"));

    // After dismiss animation
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.queryByText("Operation successful!")).not.toBeInTheDocument();
  });

  it("auto-dismisses after timeout", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Success"));
    expect(screen.getByText("Operation successful!")).toBeInTheDocument();

    // Advance past the auto-dismiss timeout (4000ms) + animation (200ms)
    act(() => {
      jest.advanceTimersByTime(4300);
    });

    expect(screen.queryByText("Operation successful!")).not.toBeInTheDocument();
  });

  it("can show multiple toasts", () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show Success"));
    fireEvent.click(screen.getByText("Show Error"));

    expect(screen.getByText("Operation successful!")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
  });

  it("throws error when useToast is used outside ToastProvider", () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<ToastTrigger />);
    }).toThrow("useToast must be used within a ToastProvider");

    consoleSpy.mockRestore();
  });
});
