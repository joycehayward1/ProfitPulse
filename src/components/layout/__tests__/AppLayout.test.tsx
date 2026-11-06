/**
 * Tests for the AppLayout component.
 */

import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppLayout } from "../AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { resetTutorialsSettingsForTests, setSavedTutorialsUrl } from "@/lib/tutorials-settings";

let savedSetting: { data: { value: string } | null; error: unknown } = { data: null, error: null };
const mockSavedQuery = jest.fn();
jest.mock("@/lib/insforge", () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  getInsForgeClient: () => ({
    database: {
      from: (table: string) => ({
        select: () => ({
          eq: (column: string, key: string) => ({
            maybeSingle: () => {
              mockSavedQuery(table, column, key);
              return Promise.resolve(savedSetting);
            },
          }),
        }),
      }),
    },
  }),
}));

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
  const mockSignOut = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "test-user",
        email: "owner@profitpulse.test",
        name: "Test Owner",
        profile: { business_name: "MyProfitPulse Test Co." },
      },
      subscription: {
        id: "test-subscription",
        user_id: "test-user",
        plan: "pro",
        billing_interval: "monthly",
        subscription_status: "active",
        trial_start_date: null,
        trial_end_date: null,
        anet_customer_profile_id: null,
        anet_payment_profile_id: null,
        anet_subscription_id: null,
        billing_cycle_start_date: "2026-01-01T00:00:00Z",
        current_period_end: "2099-01-01T00:00:00Z",
        next_billing_date: "2099-01-01T00:00:00Z",
        pending_switch_to: null,
        pending_switch_sub_id: null,
        last_payment_date: "2026-01-01T00:00:00Z",
        last_payment_amount: 29,
        last_payment_status: "success",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      loading: false,
      signOut: mockSignOut,
      refreshUser: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("renders the logo in sidebar", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    expect(screen.getAllByAltText("MyProfitPulse").length).toBeGreaterThan(0);
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
    expect(screen.getAllByText("MANAGE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("HELP").length).toBeGreaterThan(0);
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
      expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
    });

    // Click logout
    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(mockSignOut).toHaveBeenCalled();
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

  describe("Tutorials link", () => {
    const COMMUNITY =
      "https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247";
    const original = process.env.NEXT_PUBLIC_TUTORIALS_URL;

    beforeEach(() => {
      resetTutorialsSettingsForTests();
      savedSetting = { data: null, error: null };
      delete process.env.NEXT_PUBLIC_TUTORIALS_URL;
    });
    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_TUTORIALS_URL;
      else process.env.NEXT_PUBLIC_TUTORIALS_URL = original;
    });

    const renderLayout = () =>
      render(
        <AppLayout>
          <div>Test content</div>
        </AppLayout>
      );

    it("opens the community tutorials page in a new tab by default, under Glossary", async () => {
      renderLayout();

      const link = (await screen.findAllByRole("link", { name: /tutorials/i }))[0];
      expect(link).toHaveAttribute("href", COMMUNITY);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");

      const helpNav = screen.getAllByRole("navigation", { name: "HELP" })[0];
      const labels = Array.from(helpNav.querySelectorAll("a")).map((a) => a.textContent);
      expect(labels[0]).toContain("Glossary");
      expect(labels[1]).toContain("Tutorials");
      expect(screen.getAllByRole("link", { name: "Glossary" })[0]).toHaveAttribute("href", "/glossary");
    });

    it("is hidden until the saved setting has loaded, so a removed link never flashes", async () => {
      renderLayout();
      expect(screen.queryByRole("link", { name: /tutorials/i })).not.toBeInTheDocument();
      await screen.findAllByRole("link", { name: /tutorials/i });
    });

    it("uses the address an admin saved, ahead of the env fallback", async () => {
      process.env.NEXT_PUBLIC_TUTORIALS_URL = "https://env.example.test/tutorials";
      savedSetting = { data: { value: "https://saved.example.test/courses" }, error: null };
      renderLayout();

      const link = (await screen.findAllByRole("link", { name: /tutorials/i }))[0];
      expect(link).toHaveAttribute("href", "https://saved.example.test/courses");
    });

    it("uses the env value only when nothing is saved", async () => {
      process.env.NEXT_PUBLIC_TUTORIALS_URL = "https://env.example.test/tutorials";
      renderLayout();

      const link = (await screen.findAllByRole("link", { name: /tutorials/i }))[0];
      expect(link).toHaveAttribute("href", "https://env.example.test/tutorials");
    });

    it("is hidden when an admin saved an empty address", async () => {
      savedSetting = { data: { value: "" }, error: null };
      renderLayout();

      await waitFor(() => expect(mockSavedQuery).toHaveBeenCalled());
      await waitFor(() => expect(screen.getAllByRole("link", { name: "Glossary" })[0]).toBeInTheDocument());
      expect(screen.queryByRole("link", { name: /tutorials/i })).not.toBeInTheDocument();
    });

    it("is hidden when the saved value is not an http(s) URL", async () => {
      savedSetting = { data: { value: "javascript:alert(1)" }, error: null };
      renderLayout();

      await waitFor(() => expect(mockSavedQuery).toHaveBeenCalled());
      expect(screen.queryByRole("link", { name: /tutorials/i })).not.toBeInTheDocument();
    });

    it("falls back to the default when the setting can't be read", async () => {
      savedSetting = { data: null, error: { message: "relation does not exist" } };
      renderLayout();

      const link = (await screen.findAllByRole("link", { name: /tutorials/i }))[0];
      expect(link).toHaveAttribute("href", COMMUNITY);
    });

    it("updates when the admin screen saves a new address", async () => {
      renderLayout();
      await screen.findAllByRole("link", { name: /tutorials/i });

      act(() => setSavedTutorialsUrl("https://changed.example.test/page"));
      expect(screen.getAllByRole("link", { name: /tutorials/i })[0]).toHaveAttribute(
        "href",
        "https://changed.example.test/page"
      );

      act(() => setSavedTutorialsUrl(""));
      expect(screen.queryByRole("link", { name: /tutorials/i })).not.toBeInTheDocument();
    });

    it("is also in the mobile menu", async () => {
      renderLayout();
      await screen.findAllByRole("link", { name: /tutorials/i });

      fireEvent.click(screen.getByLabelText("Toggle menu"));
      await waitFor(() => {
        expect(screen.getAllByRole("link", { name: /tutorials/i })).toHaveLength(2);
      });
    });
  });

  it("renders fixed sidebar on desktop", () => {
    render(
      <AppLayout>
        <div>Test content</div>
      </AppLayout>
    );

    // The sidebar should exist with proper width class
    const sidebar = document.querySelector("aside.md\\:w-\\[232px\\]");
    expect(sidebar).toBeInTheDocument();
  });
});
