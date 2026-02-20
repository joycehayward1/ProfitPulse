import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataPage from "../page";

// Mock AppLayout
jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Toast
const mockShowToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

// Mock Papa Parse
const mockParse = jest.fn();
jest.mock("papaparse", () => ({
  __esModule: true,
  default: {
    parse: (file: File, options: unknown) => {
      mockParse(file, options);
    },
  },
}));

describe("CSV Upload Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render upload tab with drag-and-drop zone", () => {
    render(<DataPage />);

    // Switch to upload tab
    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    expect(screen.getByText("Drop your financial spreadsheet here")).toBeInTheDocument();
    expect(screen.getByText("Choose CSV File")).toBeInTheDocument();
  });

  it("should show error for non-CSV file", () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["test"], "test.txt", { type: "text/plain" });
    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    expect(mockShowToast).toHaveBeenCalledWith("error", "Please upload a CSV file");
  });

  it("should show error for file exceeding 10MB limit", () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    // Create a file larger than 10MB
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.csv", {
      type: "text/csv",
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [largeFile],
    });

    fireEvent.change(input);

    expect(mockShowToast).toHaveBeenCalledWith("error", "File size exceeds 10MB limit");
  });

  it("should parse CSV file successfully", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const csvContent = "Revenue,Expenses,Cash,Date\n1000,500,2000,2026-01\n1200,600,2500,2026-02";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    // Mock Papa Parse to call complete callback
    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [
          { Revenue: "1000", Expenses: "500", Cash: "2000", Date: "2026-01" },
          { Revenue: "1200", Expenses: "600", Cash: "2500", Date: "2026-02" },
        ],
        meta: {
          fields: ["Revenue", "Expenses", "Cash", "Date"],
        },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("success", "CSV file loaded successfully");
    });

    // Should show file info
    expect(screen.getByText("test.csv")).toBeInTheDocument();
    expect(screen.getByText("2 rows • 4 columns")).toBeInTheDocument();
  });

  it("should auto-detect column mappings", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const csvContent = "Monthly Sales,Total Costs,Bank Balance,Period\n1000,500,2000,2026-01";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [
          {
            "Monthly Sales": "1000",
            "Total Costs": "500",
            "Bank Balance": "2000",
            Period: "2026-01",
          },
        ],
        meta: {
          fields: ["Monthly Sales", "Total Costs", "Bank Balance", "Period"],
        },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Map Your Columns")).toBeInTheDocument();
    });

    // Check auto-detection worked
    const revenueSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const expensesSelect = screen.getAllByRole("combobox")[1] as HTMLSelectElement;
    const cashSelect = screen.getAllByRole("combobox")[2] as HTMLSelectElement;
    const dateSelect = screen.getAllByRole("combobox")[3] as HTMLSelectElement;

    // Auto-detection should find matches for all columns
    expect(revenueSelect.value).toBe("Monthly Sales"); // Contains "sales"
    expect(expensesSelect.value).toBe("Total Costs"); // Contains "cost"
    expect(cashSelect.value).toBe("Bank Balance"); // Contains "balance"
    // Date is optional and may match any column with date/period/month/year
    expect(dateSelect.value.length).toBeGreaterThan(0);
  });

  it("should allow manual column mapping", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const csvContent = "Col1,Col2,Col3,Col4\n1000,500,2000,2026-01";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [{ Col1: "1000", Col2: "500", Col3: "2000", Col4: "2026-01" }],
        meta: {
          fields: ["Col1", "Col2", "Col3", "Col4"],
        },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Map Your Columns")).toBeInTheDocument();
    });

    // Manually map columns
    const revenueSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(revenueSelect, { target: { value: "Col1" } });

    const expensesSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(expensesSelect, { target: { value: "Col2" } });

    const cashSelect = screen.getAllByRole("combobox")[2];
    fireEvent.change(cashSelect, { target: { value: "Col3" } });

    expect((revenueSelect as HTMLSelectElement).value).toBe("Col1");
    expect((expensesSelect as HTMLSelectElement).value).toBe("Col2");
    expect((cashSelect as HTMLSelectElement).value).toBe("Col3");
  });

  it("should display preview table with first 10 rows", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    // Create 15 rows of data
    const data = Array.from({ length: 15 }, (_, i) => ({
      Revenue: `${1000 + i * 100}`,
      Expenses: `${500 + i * 50}`,
      Cash: `${2000 + i * 200}`,
    }));

    const file = new File(["csv content"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data,
        meta: {
          fields: ["Revenue", "Expenses", "Cash"],
        },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    expect(screen.getByText("First 10 rows from your file")).toBeInTheDocument();
    expect(screen.getByText("Showing 10 of 15 rows")).toBeInTheDocument();
  });

  it("should disable import button when mapping is incomplete", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["csv"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [{ Col1: "100", Col2: "50" }],
        meta: { fields: ["Col1", "Col2"] },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Map Your Columns")).toBeInTheDocument();
    });

    // Import button should be disabled when no columns are mapped
    const importButton = screen.getByText("Import 1 Rows");
    expect(importButton).toBeDisabled();
  });

  it("should enable import button when required fields are mapped", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["csv"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [{ Revenue: "1000", Expenses: "500", Cash: "2000" }],
        meta: { fields: ["Revenue", "Expenses", "Cash"] },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Map Your Columns")).toBeInTheDocument();
    });

    // Auto-detection should map all required fields
    const importButton = screen.getByText("Import 1 Rows");
    expect(importButton).not.toBeDisabled();
  });

  it("should handle import successfully", async () => {
    jest.useFakeTimers();
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["csv"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [
          { Revenue: "1000", Expenses: "500", Cash: "2000" },
          { Revenue: "1100", Expenses: "550", Cash: "2100" },
        ],
        meta: { fields: ["Revenue", "Expenses", "Cash"] },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("Import 2 Rows")).toBeInTheDocument();
    });

    const importButton = screen.getByText("Import 2 Rows");
    fireEvent.click(importButton);

    expect(screen.getByText("Importing...")).toBeInTheDocument();

    // Fast-forward time to complete the simulated API call
    jest.advanceTimersByTime(1200);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("success", "Successfully imported 2 rows");
    });

    // Should reset back to upload zone
    expect(screen.getByText("Drop your financial spreadsheet here")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("should allow removing uploaded file", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["csv"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [{ Revenue: "1000", Expenses: "500", Cash: "2000" }],
        meta: { fields: ["Revenue", "Expenses", "Cash"] },
        errors: [],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText("test.csv")).toBeInTheDocument();
    });

    // Click Remove button
    const removeButton = screen.getByText("Remove");
    fireEvent.click(removeButton);

    // Should go back to upload zone
    expect(screen.getByText("Drop your financial spreadsheet here")).toBeInTheDocument();
  });

  it("should handle CSV parse errors gracefully", async () => {
    render(<DataPage />);

    const uploadTab = screen.getByText("Upload Spreadsheet");
    fireEvent.click(uploadTab);

    const file = new File(["invalid csv"], "test.csv", { type: "text/csv" });

    mockParse.mockImplementation((f: File, options: unknown) => {
      options.complete({
        data: [],
        meta: { fields: [] },
        errors: [{ message: "Parse error" }],
      });
    });

    const input = screen.getByText("Choose CSV File").closest("button")?.parentElement?.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", {
      value: [file],
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith("error", "Error parsing CSV file");
    });
  });
});
