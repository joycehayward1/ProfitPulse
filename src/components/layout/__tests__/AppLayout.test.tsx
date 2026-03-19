/**
 * Tests for the AppLayout component.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppLayout } from "../AppLayout";

// Mock next/navigation
const mockPush = jest.fn();
const mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <img {...props} />,
}));

describe("AppLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the logo in sidebar", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getAllByAltText("ProfitPulse").length).toBeGreaterThan(0);
  });

  it("renders all navigation items in sidebar", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    // Overview section
    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Scenarios" }).length).toBeGreaterThan(0);

    // Financials section
    expect(screen.getAllByRole("link", { name: "P&L" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Cash Flow" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Balance Sheet" }).length).toBeGreaterThan(0);

    // Settings section
    expect(screen.getAllByRole("link", { name: "Data" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0);
  });

  it("renders section headers", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getAllByText("OVERVIEW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FINANCIALS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SETTINGS").length).toBeGreaterThan(0);
  });

  it("renders user avatar in top bar", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getByLabelText("User menu")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("opens user menu when avatar is clicked", async () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    const userMenuButton = screen.getByLabelText("User menu");
    fireEvent.click(userMenuButton);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /billing/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });
  });

  it("calls logout handler when logout is clicked", async () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    // Open user menu
    fireEvent.click(screen.getByLabelText("User menu"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });

    // Click logout
    fireEvent.click(screen.getByRole("button", { name: /logout/i }));

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("opens mobile menu when hamburger is clicked", async () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    const toggleButton = screen.getByLabelText("Toggle menu");
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("has correct navigation hrefs", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    // Overview section
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute("href", "/dashboard");
    expect(screen.getAllByRole("link", { name: "Scenarios" })[0]).toHaveAttribute("href", "/scenarios");

    // Financials section
    expect(screen.getAllByRole("link", { name: "P&L" })[0]).toHaveAttribute("href", "/reports/pl");
    expect(screen.getAllByRole("link", { name: "Cash Flow" })[0]).toHaveAttribute("href", "/reports/cashflow");
    expect(screen.getAllByRole("link", { name: "Balance Sheet" })[0]).toHaveAttribute("href", "/reports/balance-sheet");

    // Settings section
    expect(screen.getAllByRole("link", { name: "Data" })[0]).toHaveAttribute("href", "/data");
    expect(screen.getAllByRole("link", { name: "Settings" })[0]).toHaveAttribute("href", "/settings");
  });

  it("renders fixed sidebar on desktop", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    // The sidebar should exist with proper width class
    const sidebar = document.querySelector("aside.md\\:w-\\[220px\\]");
    expect(sidebar).toBeInTheDocument();
  });
});
