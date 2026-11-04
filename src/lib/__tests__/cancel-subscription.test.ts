/** @jest-environment node */
const mockSendCancel = jest.fn();
const mockSuppress = jest.fn();
const mockRelease = jest.fn();
const mockCancelArb = jest.fn();
let subRow: Record<string, unknown> | null = null;
let updateError: unknown = null;

jest.mock("../ghl-events", () => ({
  sendGhlCancelEvent: (...a: unknown[]) => mockSendCancel(...a),
  suppressGhlCancel: (...a: unknown[]) => mockSuppress(...a),
  releaseGhlCancelClaim: (...a: unknown[]) => mockRelease(...a),
}));
jest.mock("../authorize-net", () => ({
  cancelARBSubscription: (...a: unknown[]) => mockCancelArb(...a),
}));
jest.mock("../insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: subRow, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: updateError }) }),
      }),
    },
  }),
}));

import { cancelSubscription } from "../cancel-subscription";

describe("cancelSubscription GHL cancel event", () => {
  const order: string[] = [];

  beforeEach(() => {
    jest.resetAllMocks();
    order.length = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
    subRow = { anet_subscription_id: "sub_1", current_period_end: "2026-12-01T00:00:00Z" };
    updateError = null;
    mockSuppress.mockImplementation(async (_u: string, id: string) => {
      order.push(`claim:${id}`);
      return true;
    });
    mockCancelArb.mockImplementation(async (id: string) => {
      order.push(`cancel:${id}`);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it("claims before cancelling at Authorize.net, then reports as user_cancel", async () => {
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(200);
    expect(order).toEqual(["claim:sub_1", "cancel:sub_1"]);
    expect(mockSendCancel).toHaveBeenCalledTimes(1);
    expect(mockSendCancel).toHaveBeenCalledWith("u1", "sub_1", expect.any(Date), "user_cancel");
  });

  it("reports admin cancels with the admin_cancel reason", async () => {
    await cancelSubscription("u1", "admin_cancel");
    expect(mockSendCancel).toHaveBeenCalledWith("u1", "sub_1", expect.any(Date), "admin_cancel");
  });

  it("claims a pending-switch subscription too but only reports the primary one", async () => {
    subRow = { anet_subscription_id: "sub_1", pending_switch_sub_id: "sub_2" };
    await cancelSubscription("u1");
    expect(order).toEqual(["claim:sub_1", "claim:sub_2", "cancel:sub_1", "cancel:sub_2"]);
    expect(mockSendCancel).toHaveBeenCalledTimes(1);
    expect(mockSendCancel.mock.calls[0][1]).toBe("sub_1");
  });

  it("does not report when the cancel was already claimed (e.g. a double click)", async () => {
    mockSuppress.mockResolvedValue(false);
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(200);
    expect(mockSendCancel).not.toHaveBeenCalled();
  });

  it("does not claim or send when there is nothing to cancel", async () => {
    subRow = { anet_subscription_id: null };
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(400);
    expect(mockSuppress).not.toHaveBeenCalled();
    expect(mockSendCancel).not.toHaveBeenCalled();
  });

  it("releases the claim and does not send when the database update fails", async () => {
    updateError = { message: "db down" };
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(500);
    expect(mockRelease).toHaveBeenCalledWith("u1", "sub_1");
    expect(mockSendCancel).not.toHaveBeenCalled();
  });
});
