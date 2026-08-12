import { getUserAccessLevel } from "@/lib/feature-gate";
import type { Subscription } from "@/lib/database.types";

function makeSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: "uuid-1",
    user_id: "user-1",
    plan: "pro",
    billing_interval: "monthly",
    subscription_status: "active",
    trial_start_date: null,
    trial_end_date: null,
    anet_customer_profile_id: "cp-1",
    anet_payment_profile_id: "pp-1",
    anet_subscription_id: "arb-1",
    billing_cycle_start_date: null,
    current_period_end: null,
    next_billing_date: null,
    pending_switch_to: null,
    pending_switch_sub_id: null,
    last_payment_date: null,
    last_payment_amount: null,
    last_payment_status: null,
    pricing_promo: null,
    comp_days: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe("getUserAccessLevel with comp_days", () => {
  it("canceled sub past period end is locked without comp days", () => {
    const sub = makeSub({
      subscription_status: "canceled",
      current_period_end: daysFromNow(-5),
    });
    expect(getUserAccessLevel(sub)).toBe("locked");
  });

  it("canceled sub past period end keeps full access within comp window", () => {
    const sub = makeSub({
      subscription_status: "canceled",
      current_period_end: daysFromNow(-5),
      comp_days: 75,
    });
    expect(getUserAccessLevel(sub)).toBe("full");
  });

  it("canceled sub is locked once the comp window has passed", () => {
    const sub = makeSub({
      subscription_status: "canceled",
      current_period_end: daysFromNow(-80),
      comp_days: 75,
    });
    expect(getUserAccessLevel(sub)).toBe("locked");
  });

  it("terminated sub keeps full access within comp window", () => {
    const sub = makeSub({
      subscription_status: "terminated",
      current_period_end: daysFromNow(-10),
      comp_days: 75,
    });
    expect(getUserAccessLevel(sub)).toBe("full");
  });

  it("terminated sub without comp days stays locked", () => {
    const sub = makeSub({
      subscription_status: "terminated",
      current_period_end: daysFromNow(-10),
    });
    expect(getUserAccessLevel(sub)).toBe("locked");
  });

  it("active sub within paid period is unaffected by comp days", () => {
    const sub = makeSub({
      current_period_end: daysFromNow(20),
      comp_days: 75,
    });
    expect(getUserAccessLevel(sub)).toBe("full");
  });
});
