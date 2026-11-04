/** @jest-environment node */
const mockSendCancel = jest.fn();
const mockCancelArb = jest.fn();
let subRow: Record<string, unknown> | null = null;
let updateError: unknown = null;

jest.mock("../ghl-events", () => ({
  sendGhlCancelEvent: (...a: unknown[]) => mockSendCancel(...a),
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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    subRow = { anet_subscription_id: "sub_1", current_period_end: "2026-12-01T00:00:00Z" };
    updateError = null;
    mockCancelArb.mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("sends the cancel event after the subscription is marked canceled", async () => {
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(200);
    expect(mockSendCancel).toHaveBeenCalledTimes(1);
    expect(mockSendCancel).toHaveBeenCalledWith("u1", "sub_1", expect.any(Date));
  });

  it("does not send when there is nothing to cancel", async () => {
    subRow = { anet_subscription_id: null };
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(400);
    expect(mockSendCancel).not.toHaveBeenCalled();
  });

  it("does not send when the database update fails", async () => {
    updateError = { message: "db down" };
    const res = await cancelSubscription("u1");
    expect(res.status).toBe(500);
    expect(mockSendCancel).not.toHaveBeenCalled();
  });
});
