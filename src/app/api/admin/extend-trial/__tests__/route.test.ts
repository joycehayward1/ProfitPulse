/** @jest-environment node */
import { NextRequest } from "next/server";

const mockSendTrialUpdated = jest.fn();
let existing: Record<string, unknown> | null = null;
let writeError: unknown = null;

jest.mock("@/lib/ghl-events", () => ({
  sendGhlTrialUpdatedEvent: (...a: unknown[]) => mockSendTrialUpdated(...a),
}));
jest.mock("@/lib/admin-auth", () => ({ requireAdmin: async () => ({ email: "admin@x.co" }) }));
jest.mock("@/lib/admin-log", () => ({ logAdminAction: jest.fn() }));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: writeError }) }),
        insert: () => Promise.resolve({ error: writeError }),
      }),
    },
  }),
}));

import { POST } from "../route";

function request(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/extend-trial", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/extend-trial GHL trial update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    existing = null;
    writeError = null;
  });
  afterEach(() => jest.restoreAllMocks());

  it("sends trial_updated with the new end date after extending", async () => {
    const res = await POST(request({ userId: "u1", days: 7 }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockSendTrialUpdated).toHaveBeenCalledTimes(1);
    const [userId, sentDate] = mockSendTrialUpdated.mock.calls[0];
    expect(userId).toBe("u1");
    expect(new Date(sentDate).toISOString()).toBe(body.trial_end_date);
  });

  it("does not send when the write fails", async () => {
    writeError = { message: "db down" };
    const res = await POST(request({ userId: "u1", days: 7 }));
    expect(res.status).toBe(500);
    expect(mockSendTrialUpdated).not.toHaveBeenCalled();
  });

  it("does not send for users who already have full access", async () => {
    existing = { subscription_status: "active", current_period_end: "2099-01-01T00:00:00Z", plan: "pro" };
    const res = await POST(request({ userId: "u1", days: 7 }));
    expect(res.status).toBe(409);
    expect(mockSendTrialUpdated).not.toHaveBeenCalled();
  });
});
