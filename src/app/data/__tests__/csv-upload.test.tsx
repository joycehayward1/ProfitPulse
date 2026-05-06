import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DataPage from "../page";

jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

describe("Spreadsheet Upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        snapshots: [
          {
            period_date: "2026-01-01",
            total_income: 1000,
            total_expenses: 500,
            net_profit: 500,
            current_assets: 2000,
            current_liabilities: 250,
          },
        ],
      }),
    });
  });

  it("renders the AI spreadsheet upload zone", () => {
    render(<DataPage />);

    fireEvent.click(screen.getByText("Upload Spreadsheet"));

    expect(screen.getByText("Upload your financial spreadsheet")).toBeInTheDocument();
    expect(screen.getByText("Choose File")).toBeInTheDocument();
    expect(screen.getByText(/Accepts .csv and .xlsx files up to 10 MB/i)).toBeInTheDocument();
  });

  it("shows an error for files over 10 MB", async () => {
    render(<DataPage />);

    fireEvent.click(screen.getByText("Upload Spreadsheet"));

    const file = new File(["x".repeat(11 * 1024 * 1024)], "large.csv", {
      type: "text/csv",
    });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    expect(await screen.findByText(/File is over 10 MB/i)).toBeInTheDocument();
  });

  it("sends uploaded spreadsheets to the extraction API", async () => {
    render(<DataPage />);

    fireEvent.click(screen.getByText("Upload Spreadsheet"));

    const file = new File(["Revenue,Expenses\n1000,500"], "test.csv", {
      type: "text/csv",
    });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;

    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/extract-financials",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
