/** @jest-environment node */
import crypto from "crypto";
import { NextRequest } from "next/server";

const mockAdminSql = jest.fn();
const mockFetch = jest.fn();
const subscriptionUpdate = jest.fn();
let matchedRows: { user_id: string }[] = [];
let claimError: unknown = null;
const claims: unknown[] = [];

jest.mock("@/lib/admin-log", () => ({ adminSql: (...a: unknown[]) => mockAdminSql(...a) }));
jest.mock("@/lib/lifecycle-emails", () => ({ notifyPaymentDeclined: jest.fn() }));
jest.mock("@/lib/authorize-net", () => ({
  getTransactionDetailsWithRetry: jest.fn(),
  computePeriodEnd: jest.fn(),
  getPlanAmount: jest.fn(),
}));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => {
        if (table === "email_log") {
          return {
            insert: (rows: unknown) => {
              claims.push(rows);
              return Promise.resolve({ error: claimError });
            },
          };
        }
        return {
          update: (payload: unknown) => {
            subscriptionUpdate(payload);
            return { eq: () => ({ select: () => Promise.resolve({ data: matchedRows, error: null }) }) };
          },
        };
      },
    },
  }),
}));

import { POST } from "../route";

const KEY = "test-signature-key";

function webhook(eventType: string, subscriptionId = "sub_1", eventDate = "2026-11-05T01:02:03.1234567Z") {
  const raw = JSON.stringify({ eventType, eventDate, payload: { id: subscriptionId } });
  const signature = crypto.createHmac("sha512", KEY).update(raw, "utf8").digest("hex").toUpperCase();
  return new NextRequest("http://localhost/api/webhooks/authorize-net", {
    method: "POST",
    headers: { "x-anet-signature": `sha512=${signature}` },
    body: raw,
  });
}

function sentPayloads(): Record<string, unknown>[] {
  return mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
}

describe("Authorize.net webhook GHL cancellation events", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    claims.length = 0;
    claimError = null;
    matchedRows = [{ user_id: "u1" }];
    process.env.ANET_SIGNATURE_KEY = KEY;
    process.env.GHL_CANCEL_WEBHOOK_URL = "https://hooks.example.com/cancel/TOKEN";
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch as unknown as typeof fetch;
    mockAdminSql.mockResolvedValue([{ email: "jane@business.com", name: "Jane Smith" }]);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GHL_CANCEL_WEBHOOK_URL;
    jest.restoreAllMocks();
  });

  it("reports a portal cancel as authnet_cancel with the event time", async () => {
    const res = await POST(webhook("net.authorize.customer.subscription.cancelled"));
    expect(res.status).toBe(200);
    expect(subscriptionUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "canceled" }));
    expect(sentPayloads()).toEqual([
      {
        email: "jane@business.com",
        first_name: "Jane",
        last_name: "Smith",
        subscription_id: "sub_1",
        cancelled_at: "2026-11-05T01:02:03.123Z",
        reason: "authnet_cancel",
        event: "subscription_cancelled",
        source: "myprofitpulse-app",
      },
    ]);
  });

  it("reports a termination as authnet_terminated", async () => {
    await POST(webhook("net.authorize.customer.subscription.terminated"));
    expect(subscriptionUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "terminated" }));
    expect(sentPayloads()).toHaveLength(1);
    expect(sentPayloads()[0]).toMatchObject({ reason: "authnet_terminated" });
  });

  it("sends nothing when the app already cancelled it (row no longer holds the id)", async () => {
    matchedRows = [];
    const res = await POST(webhook("net.authorize.customer.subscription.cancelled"));
    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends nothing when the cancel was already claimed (user/admin cancel in flight, plan switch, redelivery)", async () => {
    claimError = { code: "23505" };
    const res = await POST(webhook("net.authorize.customer.subscription.cancelled"));
    expect(res.status).toBe(200);
    expect(claims).toHaveLength(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not run twice for a cancelled-then-terminated pair on the same subscription", async () => {
    await POST(webhook("net.authorize.customer.subscription.cancelled"));
    claimError = { code: "23505" };
    await POST(webhook("net.authorize.customer.subscription.terminated"));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not report suspensions", async () => {
    await POST(webhook("net.authorize.customer.subscription.suspended"));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does nothing extra, and still returns 200, when GHL_CANCEL_WEBHOOK_URL is unset", async () => {
    delete process.env.GHL_CANCEL_WEBHOOK_URL;
    const res = await POST(webhook("net.authorize.customer.subscription.cancelled"));
    expect(res.status).toBe(200);
    expect(claims).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still returns 200 when GHL is down", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    const res = await POST(webhook("net.authorize.customer.subscription.cancelled"));
    expect(res.status).toBe(200);
  });
});
