import { getAccessSummary, getUserAccessLevel } from "../feature-gate";
import type { Subscription } from "../database.types";

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    subscription_status: "none",
    plan: "none",
    comp_days: 0,
    current_period_end: null,
    trial_end_date: null,
    last_payment_date: null,
    ...overrides,
  } as Subscription;
}

describe("getAccessSummary", () => {
  const cases: [string, Subscription | null, string][] = [
    ["no subscription", null, "none"],
    ["paid monthly", sub({ subscription_status: "active", plan: "pro", current_period_end: iso(20), anet_subscription_id: "arb-1" }), "paid"],
    ["3-month admin grant", sub({ subscription_status: "active", plan: "pro", current_period_end: iso(60) }), "granted"],
    ["expired admin grant", sub({ subscription_status: "active", plan: "pro", current_period_end: iso(-2) }), "grant_ended"],
    ["lifetime grant", sub({ subscription_status: "active", plan: "pro", current_period_end: iso(365 * 100) }), "lifetime"],
    ["canceled, still in period", sub({ subscription_status: "canceled", current_period_end: iso(5) }), "canceled_in_period"],
    ["canceled, period over", sub({ subscription_status: "canceled", current_period_end: iso(-5) }), "canceled"],
    ["terminated with comp days", sub({ subscription_status: "terminated", current_period_end: iso(-2), comp_days: 14 }), "comped"],
    ["past due within grace", sub({ subscription_status: "past_due", last_payment_date: iso(-1) }), "grace"],
    ["past due after grace", sub({ subscription_status: "past_due", last_payment_date: iso(-10) }), "past_due"],
    ["active trial", sub({ subscription_status: "trial", trial_end_date: iso(3) }), "trial"],
    ["active but period ended", sub({ subscription_status: "active", plan: "pro", current_period_end: iso(-30), anet_subscription_id: "arb-1" }), "lapsed"],
    ["expired trial", sub({ subscription_status: "trial", trial_end_date: iso(-3) }), "trial_expired"],
  ];

  it.each(cases)("%s → %s", (_label, s, reason) => {
    const summary = getAccessSummary(s);
    expect(summary.reason).toBe(reason);
    // Must always agree with the gate the app itself uses.
    expect(summary.level).toBe(getUserAccessLevel(s));
    expect(summary.until === null).toBe(summary.level === "locked");
  });
});
