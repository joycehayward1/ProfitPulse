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

  it("renders the logo", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getByAltText("ProfitPulse")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scenarios" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Data" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders user avatar with initials", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getByText("JH")).toBeInTheDocument();
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
      expect(screen.getByText("Joyce Hayward")).toBeInTheDocument();
      expect(screen.getByText("joyce@fusion4business.com")).toBeInTheDocument();
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

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Scenarios" })).toHaveAttribute("href", "/scenarios");
    expect(screen.getByRole("link", { name: "Data" })).toHaveAttribute("href", "/data");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });
});
