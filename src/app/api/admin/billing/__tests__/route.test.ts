/** @jest-environment node */
import { NextRequest } from "next/server";

const mockRequireAdmin = jest.fn();
const mockAdminSql = jest.fn();
const mockLog = jest.fn();
const mockGetTx = jest.fn();
const mockVoid = jest.fn();
const mockRefund = jest.fn();
const mockSettle = jest.fn();
const mockPaymentUpdate = jest.fn();

let subscriptionRow: Record<string, unknown> | null = null;
let paymentRow: Record<string, unknown> | null = null;

jest.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }));
jest.mock("@/lib/admin-log", () => ({
  adminSql: (...a: unknown[]) => mockAdminSql(...a),
  logAdminAction: (...a: unknown[]) => mockLog(...a),
}));
jest.mock("@/lib/authorize-net", () => ({
  getTransactionDetails: (...a: unknown[]) => mockGetTx(...a),
  voidTransaction: (...a: unknown[]) => mockVoid(...a),
  refundTransaction: (...a: unknown[]) => mockRefund(...a),
}));
jest.mock("@/lib/missed-renewal", () => {
  const actual = jest.requireActual("@/lib/missed-renewal");
  return { owesMissedRenewal: actual.owesMissedRenewal, settleMissedRenewal: (...a: unknown[]) => mockSettle(...a) };
});
jest.mock("@/lib/cancel-subscription", () => ({ cancelSubscription: jest.fn() }));
jest.mock("@/lib/plan-switch", () => ({ switchPlan: jest.fn() }));
jest.mock("@/lib/resend", () => ({ getResend: jest.fn(), FROM_EMAIL: "", REPLY_TO_EMAIL: "" }));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const chain = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          maybeSingle: () => {
            if (table === "subscriptions") return Promise.resolve({ data: subscriptionRow });
            // Only return the payment when it belongs to the requested user
            const match = paymentRow && paymentRow.id === filters.id && paymentRow.user_id === filters.user_id;
            return Promise.resolve({ data: match ? paymentRow : null });
          },
          update: (payload: unknown) => {
            mockPaymentUpdate(payload);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
        return chain;
      },
    },
  }),
}));

import { POST } from "../route";

function req(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/billing", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ id: "admin", email: "joyce@example.com" });
  mockAdminSql.mockResolvedValue([{ email: "kent@example.com" }]);
  subscriptionRow = { user_id: "u1", subscription_status: "active", last_payment_status: "success" };
  paymentRow = {
    id: "p1",
    user_id: "u1",
    status: "success",
    amount: "47.99",
    anet_transaction_id: "t1",
    description: "renewal",
  };
});

describe("POST /api/admin/billing", () => {
  it("rejects non-admins", async () => {
    mockRequireAdmin.mockResolvedValue(null);
    const res = await POST(req({ userId: "u1", action: "refund_payment", paymentId: "p1" }));
    expect(res.status).toBe(403);
  });

  it("voids a payment that hasn't settled", async () => {
    mockGetTx.mockResolvedValue({ transactionStatus: "capturedPendingSettlement", cardLast4: "4304" });
    const res = await POST(req({ userId: "u1", action: "refund_payment", paymentId: "p1" }));
    expect(res.status).toBe(200);
    expect(mockVoid).toHaveBeenCalledWith("t1");
    expect(mockRefund).not.toHaveBeenCalled();
    expect(mockPaymentUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "voided" }));
  });

  it("refunds a settled payment to the last four of the card", async () => {
    mockGetTx.mockResolvedValue({ transactionStatus: "settledSuccessfully", cardLast4: "4304" });
    const res = await POST(req({ userId: "u1", action: "refund_payment", paymentId: "p1" }));
    expect(res.status).toBe(200);
    expect(mockRefund).toHaveBeenCalledWith({ transId: "t1", amount: 47.99, cardLast4: "4304" });
    expect(mockPaymentUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "refunded" }));
  });

  it("refuses payments in any other state", async () => {
    mockGetTx.mockResolvedValue({ transactionStatus: "declined", cardLast4: "4304" });
    const res = await POST(req({ userId: "u1", action: "refund_payment", paymentId: "p1" }));
    expect(res.status).toBe(409);
    expect(mockVoid).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it("won't refund another customer's payment", async () => {
    const res = await POST(req({ userId: "someone-else", action: "refund_payment", paymentId: "p1" }));
    expect(res.status).toBe(409);
    expect(mockGetTx).not.toHaveBeenCalled();
  });

  it("won't charge a customer who doesn't owe anything", async () => {
    const res = await POST(req({ userId: "u1", action: "retry_payment" }));
    expect(res.status).toBe(409);
    expect(mockSettle).not.toHaveBeenCalled();
  });
});
