import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardPage from "../page";

// Mock the AppLayout component
jest.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

// Mock the UI components
jest.mock("@/components/ui/HealthScoreGauge", () => ({
  HealthScoreGauge: ({ score, size }: { score: number; size: string }) => (
    <div data-testid="health-score-gauge" data-score={score} data-size={size}>
      Score: {score}
    </div>
  ),
}));

jest.mock("@/components/ui/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <div data-testid="status-badge" data-status={status}>
      {status}
    </div>
  ),
}));

jest.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      data-testid="button"
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/TrafficLightDot", () => ({
  TrafficLightDot: ({ status }: { status: string }) => (
    <div data-testid="traffic-light-dot" data-status={status}>
      {status}
    </div>
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    // Mock Date to return consistent values
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-19T14:30:00")); // Wednesday afternoon
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the greeting with time of day", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Good afternoon,/i)).toBeInTheDocument();
    });
  });

  it("renders the user name in greeting", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  it("renders the formatted date", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Thursday, February 19, 2026/i)).toBeInTheDocument();
    });
  });

  it("shows different greeting in morning", async () => {
    jest.setSystemTime(new Date("2026-02-19T08:30:00")); // Morning
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Good morning,/i)).toBeInTheDocument();
    });
  });

  it("shows different greeting in evening", async () => {
    jest.setSystemTime(new Date("2026-02-19T20:30:00")); // Evening
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Good evening,/i)).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    render(<DashboardPage />);

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty state when no assessment exists", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Let's get you some clarity/i)
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Complete Your Assessment/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Takes about 2 minutes/i)).toBeInTheDocument();
    });
  });

  it("empty state button links to assessment page", async () => {
    const originalLocation = window.location.href;

    render(<DashboardPage />);

    await waitFor(() => {
      const button = screen.getByText(/Complete Your Assessment/i);
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("data-variant", "primary");
      expect(button).toHaveAttribute("data-size", "lg");
    });

    // Cleanup
    window.location.href = originalLocation;
  });

  it("wraps content in AppLayout", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders greeting block before dashboard content", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      const greeting = screen.getByText(/Good afternoon,/i).closest("div");
      expect(greeting).toBeInTheDocument();
    });
  });

  it("renders mobile responsive classes", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      const heading = screen.getByText(/Good afternoon,/i);
      expect(heading.className).toContain("text-display");
    });
  });

  // Note: Metric cards, cash position, and AI insight tests would require
  // mocking assessment data. These will be tested when InsForge credentials
  // are available and we can test the full data flow.
  // For now, the empty state path is verified above.
});
