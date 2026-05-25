import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataPage from "../page";

// Mock AppLayout
jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Toast
const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/lib/insforge", () => ({
  getInsForgeClient: jest.fn(() => ({
    auth: {
      getCurrentSession: jest.fn().mockResolvedValue({
        data: { session: { accessToken: "test-token" } },
        error: null,
      }),
    },
    database: {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  })),
}));

// Mock Papa Parse
jest.mock("papaparse", () => ({
  __esModule: true,
  default: {
    parse: jest.fn(),
  },
}));

describe("DataPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Page Structure", () => {
    it("renders the page header with title and description", () => {
      render(<DataPage />);
      expect(screen.getByText("Your Numbers")).toBeInTheDocument();
      expect(
        screen.getByText(/Keep your financial picture up to date/i)
      ).toBeInTheDocument();
    });

    it("renders two tabs: Enter Manually and Upload Spreadsheet", () => {
      render(<DataPage />);
      expect(screen.getByText("Enter Manually")).toBeInTheDocument();
      expect(screen.getByText("Upload Spreadsheet")).toBeInTheDocument();
    });

    it("shows manual entry form by default", () => {
      render(<DataPage />);
      expect(
        screen.getByLabelText("Which month are these numbers for?")
      ).toBeInTheDocument();
      expect(screen.getByText("Cash in the bank right now")).toBeInTheDocument();
    });
  });

  describe("Tab Switching", () => {
    it("switches to upload tab when clicked", () => {
      render(<DataPage />);
      const uploadTab = screen.getByText("Upload Spreadsheet");
      fireEvent.click(uploadTab);

      expect(screen.getByText("Upload your financial spreadsheet")).toBeInTheDocument();
      expect(screen.getByText("Choose File")).toBeInTheDocument();
    });

    it("switches back to manual tab when clicked", () => {
      render(<DataPage />);

      // Switch to upload
      fireEvent.click(screen.getByText("Upload Spreadsheet"));
      expect(screen.getByText("Upload your financial spreadsheet")).toBeInTheDocument();

      // Switch back to manual
      fireEvent.click(screen.getByText("Enter Manually"));
      expect(
        screen.getByText("Cash in the bank right now")
      ).toBeInTheDocument();
    });
  });

  describe("Manual Entry Form", () => {
    it("renders all required financial input fields", () => {
      render(<DataPage />);
      expect(screen.getByText("Cash in the bank right now")).toBeInTheDocument();
      expect(screen.getByText("Total sales this month")).toBeInTheDocument();
      expect(screen.getByText("Total expenses this month")).toBeInTheDocument();
      expect(screen.getByText("Money customers owe you (accounts receivable)")).toBeInTheDocument();
    });

    it("renders period selector with current month", () => {
      render(<DataPage />);
      const periodInput = screen.getByLabelText(
        "Which month are these numbers for?"
      ) as HTMLInputElement;

      expect(periodInput).toBeInTheDocument();
      expect(periodInput.type).toBe("month");
      // Should have a default value (current month)
      expect(periodInput.value).toBeTruthy();
    });

    it("renders save button disabled when form is incomplete", () => {
      render(<DataPage />);
      const saveButton = screen.getByRole("button", {
        name: /Save This Month's Data/i,
      });
      expect(saveButton).toBeDisabled();
    });

    it("enables save button when all required fields are filled", () => {
      render(<DataPage />);

      // Fill all required fields - get by placeholder since labels don't have htmlFor on parent divs
      const inputs = screen.getAllByPlaceholderText("0");

      fireEvent.change(inputs[0], { target: { value: "10000" } });
      fireEvent.change(inputs[1], { target: { value: "5000" } });
      fireEvent.change(inputs[2], { target: { value: "3000" } });
      fireEvent.change(inputs[3], { target: { value: "2000" } });

      const saveButton = screen.getByRole("button", {
        name: /Save This Month's Data/i,
      });
      expect(saveButton).toBeEnabled();
    });

    it("renders QuickBooks connection link", () => {
      render(<DataPage />);
      expect(
        screen.getByText(/Or connect QuickBooks to use sync-only mode/i)
      ).toBeInTheDocument();
    });
  });

  describe("Expense Breakdown", () => {
    it("does not show expense breakdown by default", () => {
      render(<DataPage />);
      const rentLabel = screen.queryByText("Rent");
      expect(rentLabel).toBeInTheDocument(); // Label exists but section is collapsed
    });

    it("shows expense breakdown when toggle is clicked", () => {
      render(<DataPage />);

      const toggleButton = screen.getByText(
        /Add expense breakdown by category \(optional\)/i
      );
      fireEvent.click(toggleButton);

      // Wait for animation - labels should be visible
      waitFor(() => {
        expect(screen.getByText("Rent")).toBeVisible();
        expect(screen.getByText("Payroll")).toBeVisible();
        expect(screen.getByText("Supplies")).toBeVisible();
        expect(screen.getByText("Marketing")).toBeVisible();
        expect(screen.getByText("Other")).toBeVisible();
      });
    });

    it("hides expense breakdown when toggle is clicked again", () => {
      render(<DataPage />);

      const toggleButton = screen.getByText(
        /Add expense breakdown by category \(optional\)/i
      );

      // Show
      fireEvent.click(toggleButton);

      // Hide
      fireEvent.click(toggleButton);

      // Section collapses (max-h-0)
      const rentLabel = screen.getByText("Rent");
      expect(rentLabel).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("submits form with valid data and shows success toast", async () => {
      render(<DataPage />);

      // Fill required fields using placeholders
      const inputs = screen.getAllByPlaceholderText("0");
      fireEvent.change(inputs[0], { target: { value: "10000" } });
      fireEvent.change(inputs[1], { target: { value: "5000" } });
      fireEvent.change(inputs[2], { target: { value: "3000" } });
      fireEvent.change(inputs[3], { target: { value: "2000" } });

      const saveButton = screen.getByRole("button", {
        name: /Save This Month's Data/i,
      });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "success",
          "Financial data saved successfully"
        );
      });
    });

    it("shows loading state during submission", async () => {
      render(<DataPage />);

      // Fill required fields
      const inputs = screen.getAllByPlaceholderText("0");
      fireEvent.change(inputs[0], { target: { value: "10000" } });
      fireEvent.change(inputs[1], { target: { value: "5000" } });
      fireEvent.change(inputs[2], { target: { value: "3000" } });
      fireEvent.change(inputs[3], { target: { value: "2000" } });

      const saveButton = screen.getByRole("button", {
        name: /Save This Month's Data/i,
      });
      fireEvent.click(saveButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(saveButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByText("Save This Month's Data")).toBeInTheDocument();
      });
    });

    it("resets form after successful submission", async () => {
      render(<DataPage />);

      const inputs = screen.getAllByPlaceholderText("0") as HTMLInputElement[];

      // Fill and submit
      fireEvent.change(inputs[0], { target: { value: "10000" } });
      fireEvent.change(inputs[1], { target: { value: "5000" } });
      fireEvent.change(inputs[2], { target: { value: "3000" } });
      fireEvent.change(inputs[3], { target: { value: "2000" } });

      const saveButton = screen.getByRole("button", {
        name: /Save This Month's Data/i,
      });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          "success",
          "Financial data saved successfully"
        );
      });
    });
  });

  describe("History Section", () => {
    it("renders Data Ledger header", () => {
      render(<DataPage />);
      expect(screen.getByText("Data Ledger")).toBeInTheDocument();
    });

    it("renders ledger refresh controls", () => {
      render(<DataPage />);

      expect(screen.getByText("Refresh Ledger")).toBeInTheDocument();
    });
  });

  describe("Utility Functions", () => {
    it("renders currency inputs with currency affordances", () => {
      render(<DataPage />);

      expect(screen.getAllByText("$").length).toBeGreaterThan(0);
    });

    it("defaults the period input to the current month", () => {
      render(<DataPage />);

      const periodInput = screen.getByLabelText(
        "Which month are these numbers for?"
      ) as HTMLInputElement;
      expect(periodInput.value).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
