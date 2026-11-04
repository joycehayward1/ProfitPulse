import {
  buildGhlCancelPayload,
  buildGhlPurchasePayload,
  buildGhlSignupPayload,
  buildGhlTrialUpdatedPayload,
  postGhlEvent,
  splitFullName,
} from "../ghl";

describe("splitFullName", () => {
  it("splits first and last name", () => {
    expect(splitFullName("Jane Smith")).toEqual({
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("handles single names", () => {
    expect(splitFullName("Madonna")).toEqual({
      firstName: "Madonna",
      lastName: "",
    });
  });

  it("handles multi-part last names", () => {
    expect(splitFullName("Mary Jane Watson")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });
});

describe("buildGhlSignupPayload", () => {
  it("builds GHL-friendly payload with normalized email", () => {
    expect(
      buildGhlSignupPayload({
        email: "Jane@Business.COM",
        fullName: "Jane Smith",
      })
    ).toEqual({
      email: "jane@business.com",
      name: "Jane Smith",
      first_name: "Jane",
      last_name: "Smith",
      source: "MyProfitPulse App Signup",
    });
  });
});

describe("buildGhlSignupPayload trial_end_date", () => {
  it("adds trial_end_date as ISO 8601 when given", () => {
    const payload = buildGhlSignupPayload({
      email: "jane@business.com",
      fullName: "Jane Smith",
      trialEndDate: "2026-11-11T17:00:00+00:00",
    });
    expect(payload.trial_end_date).toBe("2026-11-11T17:00:00.000Z");
  });

  it("omits trial_end_date when the account has no trial", () => {
    const payload = buildGhlSignupPayload({
      email: "jane@business.com",
      fullName: "Jane Smith",
      trialEndDate: null,
    });
    expect(payload).not.toHaveProperty("trial_end_date");
  });
});

describe("buildGhlPurchasePayload", () => {
  it("builds the exact field set GHL expects", () => {
    expect(
      buildGhlPurchasePayload({
        email: " Jane@Business.COM ",
        fullName: "Jane Marie Smith",
        billingInterval: "monthly",
        amount: 59.99,
        purchasedAt: new Date("2026-11-04T17:00:00Z"),
        subscriptionId: "12345678",
        transactionId: "987654321",
      })
    ).toEqual({
      email: "jane@business.com",
      name: "Jane Marie Smith",
      first_name: "Jane",
      last_name: "Marie Smith",
      plan: "pro_monthly",
      amount: 59.99,
      currency: "USD",
      purchase_date: "2026-11-04T17:00:00.000Z",
      subscription_id: "12345678",
      transaction_id: "987654321",
      source: "myprofitpulse-app",
    });
  });

  it("labels annual plans and keeps amount a two-decimal number", () => {
    const payload = buildGhlPurchasePayload({
      email: "a@b.co",
      fullName: "",
      billingInterval: "annual",
      amount: 503.9100000001,
      purchasedAt: "2026-11-04T17:00:00Z",
      subscriptionId: "1",
      transactionId: "2",
    });
    expect(payload.plan).toBe("pro_annual");
    expect(payload.amount).toBe(503.91);
    expect(payload.first_name).toBe("");
  });
});

describe("buildGhlTrialUpdatedPayload", () => {
  it("builds the trial_updated payload", () => {
    expect(
      buildGhlTrialUpdatedPayload({
        email: "Jane@Business.com",
        fullName: "Jane Smith",
        trialEndDate: new Date("2026-11-18T12:30:00Z"),
      })
    ).toEqual({
      email: "jane@business.com",
      first_name: "Jane",
      last_name: "Smith",
      trial_end_date: "2026-11-18T12:30:00.000Z",
      event: "trial_updated",
      source: "myprofitpulse-app",
    });
  });
});

describe("buildGhlCancelPayload", () => {
  it("builds the subscription_cancelled payload", () => {
    expect(
      buildGhlCancelPayload({
        email: "jane@business.com",
        fullName: "Jane Smith",
        subscriptionId: "12345678",
        cancelledAt: new Date("2026-11-05T01:02:03Z"),
      })
    ).toEqual({
      email: "jane@business.com",
      first_name: "Jane",
      last_name: "Smith",
      subscription_id: "12345678",
      cancelled_at: "2026-11-05T01:02:03.000Z",
      event: "subscription_cancelled",
      source: "myprofitpulse-app",
    });
  });
});

describe("postGhlEvent", () => {
  const SECRET_URL = "https://hooks.example.com/webhook/SECRET-TOKEN";
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.GHL_PURCHASE_WEBHOOK_URL;
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GHL_PURCHASE_WEBHOOK_URL;
    jest.restoreAllMocks();
  });

  function loggedText(): string {
    return [errorSpy, warnSpy, logSpy]
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map(String).join(" "))
      .join("\n");
  }

  it("skips silently without calling fetch when the env var is unset", async () => {
    await expect(postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", { a: 1 })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("treats a blank env var as unset", async () => {
    process.env.GHL_PURCHASE_WEBHOOK_URL = "   ";
    await postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", { a: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the JSON payload with an abort signal when configured", async () => {
    process.env.GHL_PURCHASE_WEBHOOK_URL = SECRET_URL;
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", { a: 1 })).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SECRET_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
    expect(init.signal).toBeDefined();
  });

  it("logs but does not throw on a non-2xx response, without the URL", async () => {
    process.env.GHL_PURCHASE_WEBHOOK_URL = SECRET_URL;
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", {})).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalled();
    expect(loggedText()).toContain("500");
    expect(loggedText()).not.toContain("SECRET-TOKEN");
  });

  it("logs but does not throw when fetch rejects, without the URL", async () => {
    process.env.GHL_PURCHASE_WEBHOOK_URL = SECRET_URL;
    fetchMock.mockRejectedValue(new TypeError(`Failed to parse URL from ${SECRET_URL}`));

    await expect(postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", {})).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalled();
    expect(loggedText()).not.toContain("SECRET-TOKEN");
  });

  it("aborts a hung request after the timeout", async () => {
    jest.useFakeTimers();
    try {
      process.env.GHL_PURCHASE_WEBHOOK_URL = SECRET_URL;
      fetchMock.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          })
      );

      const pending = postGhlEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", {});
      await jest.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toBe(false);
      expect(loggedText()).toContain("AbortError");
    } finally {
      jest.useRealTimers();
    }
  });
});
