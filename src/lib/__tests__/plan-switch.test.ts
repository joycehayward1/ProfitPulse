/** @jest-environment node */
const mockSuppress = jest.fn();
const mockRelease = jest.fn();
const mockCancelArb = jest.fn();
const mockCharge = jest.fn();
const mockCreateArb = jest.fn();
const order: string[] = [];
let subRow: Record<string, unknown>;

jest.mock("../ghl-events", () => ({
  suppressGhlCancel: (...a: unknown[]) => mockSuppress(...a),
  releaseGhlCancelClaim: (...a: unknown[]) => mockRelease(...a),
}));
jest.mock("../authorize-net", () => ({
  cancelARBSubscription: (...a: unknown[]) => mockCancelArb(...a),
  chargeCustomerProfile: (...a: unknown[]) => mockCharge(...a),
  createARBSubscription: (...a: unknown[]) => mockCreateArb(...a),
  computePeriodEnd: (_i: string, from: Date) => new Date(from.getTime() + 30 * 86_400_000),
  getCustomerProfile: jest.fn().mockResolvedValue({ paymentProfiles: [] }),
  anetInvoiceNumber: () => "SW1",
}));
jest.mock("../insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: subRow, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      }),
    },
  }),
}));

import { switchPlan } from "../plan-switch";

describe("switchPlan GHL cancel suppression", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    order.length = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
    subRow = {
      subscription_status: "active",
      billing_interval: "annual",
      anet_subscription_id: "old_sub",
      anet_customer_profile_id: "cp",
      anet_payment_profile_id: "pp",
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
    mockSuppress.mockImplementation(async (_u: string, id: string) => {
      order.push(`claim:${id}`);
      return true;
    });
    mockCancelArb.mockImplementation(async (id: string) => {
      order.push(`cancel:${id}`);
    });
    mockCreateArb.mockResolvedValue({ subscriptionId: "new_sub" });
  });
  afterEach(() => jest.restoreAllMocks());

  it("claims the replaced subscription before cancelling it", async () => {
    const res = await switchPlan("u1", "monthly");
    expect(res.status).toBe(200);
    expect(order).toEqual(["claim:old_sub", "cancel:old_sub"]);
    expect(mockSuppress).toHaveBeenCalledWith("u1", "old_sub");
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("releases the claim when the cancel fails, since the subscription is still live", async () => {
    mockCancelArb.mockRejectedValue(new Error("anet down"));
    const res = await switchPlan("u1", "monthly");
    expect(res.status).toBe(400);
    expect(mockRelease).toHaveBeenCalledWith("u1", "old_sub");
  });
});
