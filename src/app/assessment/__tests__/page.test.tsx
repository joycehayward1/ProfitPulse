import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssessmentPage from "../page";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock toast
jest.mock("@/components/ui/Toast", () => ({
  useToast: jest.fn(),
}));

// Mock InsForge
jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: jest.fn(() => ({
    database: {
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

describe("AssessmentPage", () => {
  const mockPush = jest.fn();
  const mockShowToast = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast });
    jest.clearAllMocks();
  });

  it("renders welcome message", () => {
    render(<AssessmentPage />);
    expect(screen.getByText(/Let's get you some clarity on your business/i)).toBeInTheDocument();
  });

  it("shows first question on initial render", () => {
    render(<AssessmentPage />);
    expect(screen.getByText(/How much cash do you have in the bank right now?/i)).toBeInTheDocument();
  });

  it("shows progress indicator", () => {
    render(<AssessmentPage />);
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("disables Back button on first step", () => {
    render(<AssessmentPage />);
    const backButton = screen.getByText("Back");
    expect(backButton).toBeDisabled();
  });

  it("shows validation error when Next is clicked with empty required field", () => {
    render(<AssessmentPage />);
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("advances to next question when valid input is provided", () => {
    render(<AssessmentPage />);

    // Fill in first question
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "10000" } });

    // Click Next
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    // Should show second question
    expect(screen.getByText(/What were your total sales last month?/i)).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
  });

  it("allows going back to previous question", () => {
    render(<AssessmentPage />);

    // Advance to step 2
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "10000" } });
    fireEvent.click(screen.getByText("Next"));

    // Go back
    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    // Should be back at first question
    expect(screen.getByText(/How much cash do you have in the bank right now?/i)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("shows Finish button on last step", () => {
    render(<AssessmentPage />);

    // Advance through all steps
    const questions = [
      "10000",  // cash
      "25000",  // revenue
      "20000",  // expenses
      "5000",   // receivables
    ];

    questions.forEach((value) => {
      const input = screen.getByPlaceholderText(/0.00|0/);
      fireEvent.change(input, { target: { value } });
      fireEvent.click(screen.getByText("Next"));
    });

    // Step 5 - employee count
    const employeeInput = screen.getByPlaceholderText("0");
    fireEvent.change(employeeInput, { target: { value: "5" } });
    fireEvent.click(screen.getByText("Next"));

    // Step 6 - should show Finish
    expect(screen.getByText("Finish")).toBeInTheDocument();
  });

  it("allows skipping optional textarea question", async () => {
    render(<AssessmentPage />);

    // Advance through all required steps
    const questions = ["10000", "25000", "20000", "5000"];

    questions.forEach((value) => {
      const input = screen.getByPlaceholderText(/0.00|0/);
      fireEvent.change(input, { target: { value } });
      fireEvent.click(screen.getByText("Next"));
    });

    // Employee count
    const employeeInput = screen.getByPlaceholderText("0");
    fireEvent.change(employeeInput, { target: { value: "5" } });
    fireEvent.click(screen.getByText("Next"));

    // Last question (textarea) - click Finish without filling
    const finishButton = screen.getByText("Finish");
    fireEvent.click(finishButton);

    // Should submit successfully
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("success", expect.any(String));
    });
  });

  it("submits assessment and redirects on completion", async () => {
    render(<AssessmentPage />);

    // Fill in all questions
    const questionValues = [
      "10000",  // cash
      "25000",  // revenue
      "20000",  // expenses
      "5000",   // receivables
    ];

    questionValues.forEach((value) => {
      const input = screen.getByPlaceholderText(/0.00|0/);
      fireEvent.change(input, { target: { value } });
      fireEvent.click(screen.getByText("Next"));
    });

    // Employee count
    const employeeInput = screen.getByPlaceholderText("0");
    fireEvent.change(employeeInput, { target: { value: "5" } });
    fireEvent.click(screen.getByText("Next"));

    // Textarea
    const textarea = screen.getByPlaceholderText(/Take your time/i);
    fireEvent.change(textarea, { target: { value: "Cash flow concerns" } });

    // Submit
    const finishButton = screen.getByText("Finish");
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/assessment/results");
    });
  });

  it("shows progress bar with correct percentage", () => {
    render(<AssessmentPage />);

    // Initially at step 1 (16.67%)
    expect(screen.getByText("17%")).toBeInTheDocument();

    // Advance to step 2
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "10000" } });
    fireEvent.click(screen.getByText("Next"));

    // Now at step 2 (33.33%)
    expect(screen.getByText("33%")).toBeInTheDocument();
  });
});
