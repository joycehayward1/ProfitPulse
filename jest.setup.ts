import "@testing-library/jest-dom";
import type { ReactNode } from "react";

process.env.NEXT_PUBLIC_INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL || "https://test.insforge.app";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "test-anon-key";
process.env.INSFORGE_API_KEY = process.env.INSFORGE_API_KEY || "test-admin-key";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => "/dashboard"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

jest.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: jest.fn(() => ({
    user: {
      id: "test-user",
      email: "owner@profitpulse.test",
      name: "Test Owner",
      profile: {
        name: "Test Owner",
        business_name: "MyProfitPulse Test Co.",
        industry: "Services",
      },
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
    signOut: jest.fn().mockResolvedValue(undefined),
    refreshUser: jest.fn().mockResolvedValue(undefined),
  })),
}));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
}) as jest.Mock;
