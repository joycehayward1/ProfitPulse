const mockAdminSql = jest.fn();

jest.mock("../admin-log", () => ({
  adminSql: (...args: unknown[]) => mockAdminSql(...args),
}));

import {
  getSignupTrialEndDate,
  sendGhlCancelEvent,
  sendGhlPurchaseEvent,
  sendGhlTrialUpdatedEvent,
} from "../ghl-events";

const URL_VARS = [
  "GHL_PURCHASE_WEBHOOK_URL",
  "GHL_TRIAL_UPDATE_WEBHOOK_URL",
  "GHL_CANCEL_WEBHOOK_URL",
] as const;

const purchase = {
  billingInterval: "annual" as const,
  amount: 503.91,
  purchasedAt: new Date("2026-11-04T17:00:00Z"),
  subscriptionId: "sub_1",
  transactionId: "txn_1",
};

describe("GHL lifecycle events", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    mockAdminSql.mockReset();
    URL_VARS.forEach((v) => delete process.env[v]);
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    URL_VARS.forEach((v) => delete process.env[v]);
    jest.restoreAllMocks();
  });

  describe("when the env vars are unset", () => {
    it("does nothing at all: no lookup, no request, no log", async () => {
      await sendGhlPurchaseEvent("u1", purchase);
      await sendGhlTrialUpdatedEvent("u1", new Date());
      await sendGhlCancelEvent("u1", "sub_1", new Date());

      expect(mockAdminSql).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("when configured", () => {
    beforeEach(() => {
      process.env.GHL_PURCHASE_WEBHOOK_URL = "https://hooks.example.com/purchase/TOKEN";
      process.env.GHL_TRIAL_UPDATE_WEBHOOK_URL = "https://hooks.example.com/trial/TOKEN";
      process.env.GHL_CANCEL_WEBHOOK_URL = "https://hooks.example.com/cancel/TOKEN";
      mockAdminSql.mockResolvedValue([{ email: "Jane@Business.com", name: "Jane Smith" }]);
    });

    it("sends the purchase payload to the purchase URL", async () => {
      await sendGhlPurchaseEvent("u1", purchase);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://hooks.example.com/purchase/TOKEN");
      expect(JSON.parse(init.body)).toEqual({
        email: "jane@business.com",
        name: "Jane Smith",
        first_name: "Jane",
        last_name: "Smith",
        plan: "pro_annual",
        amount: 503.91,
        currency: "USD",
        purchase_date: "2026-11-04T17:00:00.000Z",
        subscription_id: "sub_1",
        transaction_id: "txn_1",
        source: "myprofitpulse-app",
      });
    });

    it("falls back to the supplied name when the account has none", async () => {
      mockAdminSql.mockResolvedValue([{ email: "jane@business.com", name: null }]);
      await sendGhlPurchaseEvent("u1", purchase, "Jane Smith");
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).first_name).toBe("Jane");
    });

    it("sends trial_updated to its own URL", async () => {
      await sendGhlTrialUpdatedEvent("u1", new Date("2026-11-18T12:30:00Z"));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://hooks.example.com/trial/TOKEN");
      expect(JSON.parse(init.body)).toEqual({
        email: "jane@business.com",
        first_name: "Jane",
        last_name: "Smith",
        trial_end_date: "2026-11-18T12:30:00.000Z",
        event: "trial_updated",
        source: "myprofitpulse-app",
      });
    });

    it("sends subscription_cancelled to the cancel URL", async () => {
      await sendGhlCancelEvent("u1", "sub_1", new Date("2026-11-05T01:02:03Z"));

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://hooks.example.com/cancel/TOKEN");
      expect(JSON.parse(init.body)).toMatchObject({
        subscription_id: "sub_1",
        cancelled_at: "2026-11-05T01:02:03.000Z",
        event: "subscription_cancelled",
      });
    });

    it("only fires the sender whose env var is set", async () => {
      delete process.env.GHL_TRIAL_UPDATE_WEBHOOK_URL;
      await sendGhlTrialUpdatedEvent("u1", new Date());
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips deleted or unknown accounts", async () => {
      mockAdminSql.mockResolvedValue([{ email: "x@deleted.invalid", name: "Gone" }]);
      await sendGhlPurchaseEvent("u1", purchase);
      mockAdminSql.mockResolvedValue(null);
      await sendGhlPurchaseEvent("u1", purchase);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("never throws when the lookup or the webhook fails", async () => {
      mockAdminSql.mockRejectedValue(new Error("db down"));
      await expect(sendGhlPurchaseEvent("u1", purchase)).resolves.toBeUndefined();

      mockAdminSql.mockResolvedValue([{ email: "jane@business.com", name: "Jane" }]);
      fetchMock.mockRejectedValue(new Error("network down"));
      await expect(sendGhlCancelEvent("u1", "sub_1", new Date())).resolves.toBeUndefined();
      fetchMock.mockResolvedValue({ ok: false, status: 502 });
      await expect(sendGhlTrialUpdatedEvent("u1", new Date())).resolves.toBeUndefined();
    });
  });
});

describe("getSignupTrialEndDate", () => {
  beforeEach(() => mockAdminSql.mockReset());

  it("returns no date for comped allowlist emails", async () => {
    mockAdminSql.mockResolvedValueOnce([{ "?column?": 1 }]);
    await expect(getSignupTrialEndDate("a@b.co")).resolves.toBeNull();
  });

  it("uses the stored trial_end_date when a trial row exists", async () => {
    mockAdminSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ trial_end_date: "2026-11-11T17:00:00+00:00" }]);
    await expect(getSignupTrialEndDate("a@b.co")).resolves.toBe("2026-11-11T17:00:00.000Z");
  });

  it("estimates now + 7 days when no trial row exists yet", async () => {
    mockAdminSql.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const before = Date.now();
    const iso = await getSignupTrialEndDate("a@b.co");
    const days = (new Date(iso as string).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
  });

  it("still estimates when the lookups fail", async () => {
    mockAdminSql.mockResolvedValue(null);
    await expect(getSignupTrialEndDate("a@b.co")).resolves.toEqual(expect.any(String));
  });
});
