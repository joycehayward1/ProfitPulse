import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssessmentPage from "../page";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: jest.fn(),
}));

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
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
        insert: mockInsert,
        upsert: mockUpsert,
      })),
    },
  })),
}));

describe("AssessmentPage", () => {
  const mockPush = jest.fn();
  const mockShowToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/assessment");
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (useToast as jest.Mock).mockReturnValue({ showToast: mockShowToast });
  });

  it("starts with source selection", async () => {
    render(<AssessmentPage />);

    expect(await screen.findByText(/Let's get you some clarity on your business/i)).toBeInTheDocument();
    expect(screen.getByText("Upload Spreadsheets (Recommended)")).toBeInTheDocument();
    expect(screen.getByText("Enter Manually")).toBeInTheDocument();
  });

  it("opens the manual financial data form", async () => {
    render(<AssessmentPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Enter Manually/i }));

    expect(screen.getByText("Enter Your Financial Data")).toBeInTheDocument();
    expect(screen.getByText("Cash in the bank right now")).toBeInTheDocument();
    expect(screen.getByText("Monthly revenue (average)")).toBeInTheDocument();
    expect(screen.getByText("Monthly expenses (average)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /See My Health Assessment/i })).toBeDisabled();
  });

  it("submits manual assessment data and redirects to results", async () => {
    render(<AssessmentPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Enter Manually/i }));

    const inputs = screen.getAllByPlaceholderText("0") as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "10000" } });
    fireEvent.change(inputs[1], { target: { value: "25000" } });
    fireEvent.change(inputs[2], { target: { value: "20000" } });
    fireEvent.change(inputs[3], { target: { value: "5000" } });

    fireEvent.click(screen.getByRole("button", { name: /See My Health Assessment/i }));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("opens the spreadsheet upload flow", async () => {
    render(<AssessmentPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Upload Spreadsheets/i }));

    expect(screen.getByText("Upload Your Financial Data")).toBeInTheDocument();
    expect(screen.getByText(/Drop your files here/i)).toBeInTheDocument();
  });
});
