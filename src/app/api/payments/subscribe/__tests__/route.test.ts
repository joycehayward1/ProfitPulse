/** @jest-environment node */
import { NextRequest } from "next/server";

const mockSendPurchase = jest.fn();
const mockCharge = jest.fn();
const mockEnsureProfile = jest.fn();
const mockCreateArb = jest.fn();
const mockGetArb = jest.fn();
let upsertResult: { error: unknown } = { error: null };
let existingSub: Record<string, unknown> | null = null;

jest.mock("@/lib/ghl-events", () => ({
  sendGhlPurchaseEvent: (...a: unknown[]) => mockSendPurchase(...a),
}));
jest.mock("@/lib/server-auth", () => ({ getAuthenticatedUserId: async () => "user-1" }));
jest.mock("@/lib/authorize-net", () => ({
  ensureCustomerProfileWithPayment: (...a: unknown[]) => mockEnsureProfile(...a),
  createCustomerPaymentProfile: jest.fn(),
  chargeCustomerProfile: (...a: unknown[]) => mockCharge(...a),
  createARBSubscription: (...a: unknown[]) => mockCreateArb(...a),
  getARBSubscription: (...a: unknown[]) => mockGetArb(...a),
  getPlanAmount: () => 59.99,
  computePeriodEnd: (_i: string, from: Date) => new Date(from.getTime() + 30 * 86_400_000),
}));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: table === "subscriptions" ? existingSub : null }) }),
        }),
        upsert: () => Promise.resolve(upsertResult),
        insert: () => Promise.resolve({ error: null }),
      }),
    },
  }),
}));

import { POST } from "../route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/payments/subscribe", {
    method: "POST",
    body: JSON.stringify({
      billingInterval: "monthly",
      nonce: { dataDescriptor: "d", dataValue: "v" },
      customer: { email: "jane@business.com", firstName: "Jane", lastName: "Smith" },
    }),
  });
}

describe("POST /api/payments/subscribe GHL purchase event", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    upsertResult = { error: null };
    existingSub = null;
    mockEnsureProfile.mockResolvedValue({ customerProfileId: "cp", customerPaymentProfileId: "pp" });
    mockCharge.mockResolvedValue({ transId: "txn_1" });
    mockCreateArb.mockResolvedValue({ subscriptionId: "sub_1" });
  });

  afterEach(() => jest.restoreAllMocks());

  it("sends the purchase event once after a successful subscribe", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mockSendPurchase).toHaveBeenCalledTimes(1);
    expect(mockSendPurchase).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        billingInterval: "monthly",
        amount: 59.99,
        subscriptionId: "sub_1",
        transactionId: "txn_1",
      }),
      "Jane Smith"
    );
  });

  it("does not send the event when the card is declined", async () => {
    mockCharge.mockRejectedValue(new Error("[2] This transaction has been declined."));
    const res = await POST(request());
    expect(res.status).toBe(400);
    expect(mockSendPurchase).not.toHaveBeenCalled();
  });

  it("does not send the event when the subscription cannot be created", async () => {
    mockCreateArb.mockRejectedValue(new Error("ARB failed"));
    await POST(request());
    expect(mockSendPurchase).not.toHaveBeenCalled();
  });

  it("does not send the event when the user already has an active subscription", async () => {
    existingSub = { subscription_status: "active" };
    const res = await POST(request());
    expect(res.status).toBe(400);
    expect(mockCharge).not.toHaveBeenCalled();
    expect(mockSendPurchase).not.toHaveBeenCalled();
  });

  it("still sends the event when the charge succeeded but the DB write failed", async () => {
    upsertResult = { error: { message: "db down" } };
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mockSendPurchase).toHaveBeenCalledTimes(1);
  });
});
