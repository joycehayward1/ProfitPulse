import type { Subscription } from "../database.types";

const mockCharge = jest.fn();
const mockGetARB = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();

jest.mock("../authorize-net", () => ({
  chargeCustomerProfile: (...args: unknown[]) => mockCharge(...args),
  getARBSubscription: (...args: unknown[]) => mockGetARB(...args),
  getPlanAmount: () => 59.99,
  computePeriodEnd: (_interval: string, from: Date) => {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d;
  },
}));

jest.mock("../insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => ({
        update: (payload: unknown) => {
          mockUpdate(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert: (rows: unknown) => {
          mockInsert(rows);
          return Promise.resolve({ error: null });
        },
      }),
    },
  }),
}));

import { owesMissedRenewal, settleMissedRenewal } from "../missed-renewal";

const DAY = 86_400_000;

function owing(overrides: Partial<Subscription> = {}): Subscription {
  return {
    user_id: "user-1",
    subscription_status: "past_due",
    billing_interval: "monthly",
    pricing_promo: "launch",
    anet_subscription_id: "73509193",
    anet_customer_profile_id: "cust-1",
    anet_payment_profile_id: "pay-1",
    last_payment_status: "failed",
    last_payment_amount: 47.99,
    current_period_end: new Date(Date.now() - 5 * DAY).toISOString(),
    ...overrides,
  } as Subscription;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetARB.mockResolvedValue({ status: "active" });
});

describe("owesMissedRenewal", () => {
  it("is true for a declined renewal on a live subscription", () => {
    expect(owesMissedRenewal(owing())).toBe(true);
  });

  it("is false when the last payment succeeded or there's no ARB", () => {
    expect(owesMissedRenewal(owing({ last_payment_status: "success" }))).toBe(false);
    expect(owesMissedRenewal(owing({ anet_subscription_id: null }))).toBe(false);
    expect(owesMissedRenewal(owing({ subscription_status: "canceled" }))).toBe(false);
    expect(owesMissedRenewal(null)).toBe(false);
  });
});

describe("settleMissedRenewal", () => {
  it("charges the owed amount and restores access through the next billing date", async () => {
    mockCharge.mockResolvedValue({ transId: "t-1" });
    const sub = owing();

    const result = await settleMissedRenewal(sub, "pay-2", "kent@example.com");

    expect(mockCharge).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 47.99, customerPaymentProfileId: "pay-2" })
    );
    expect(result.status).toBe("paid");
    const update = mockUpdate.mock.calls[0][0];
    expect(update.subscription_status).toBe("active");
    expect(update.last_payment_status).toBe("success");
    expect(new Date(update.current_period_end).getTime()).toBeGreaterThan(Date.now());
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ anet_transaction_id: "t-1", status: "success" }),
    ]);
  });

  it("reports a decline without touching the subscription", async () => {
    mockCharge.mockRejectedValue(new Error("[chargeCustomerProfile] This transaction has been declined."));

    const result = await settleMissedRenewal(owing(), "pay-1");

    expect(result).toEqual(expect.objectContaining({ status: "declined" }));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("never charges a suspended subscription (Authorize.net retries it itself)", async () => {
    mockGetARB.mockResolvedValue({ status: "suspended" });

    const result = await settleMissedRenewal(owing(), "pay-2");

    expect(result.status).toBe("left_to_authorize_net");
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it("refuses to charge when the subscription state can't be confirmed", async () => {
    mockGetARB.mockRejectedValue(new Error("network"));

    await expect(settleMissedRenewal(owing(), "pay-2")).rejects.toThrow();
    expect(mockCharge).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is owed", async () => {
    const result = await settleMissedRenewal(owing({ last_payment_status: "success" }), "pay-1");
    expect(result.status).toBe("nothing_owed");
    expect(mockCharge).not.toHaveBeenCalled();
  });
});
