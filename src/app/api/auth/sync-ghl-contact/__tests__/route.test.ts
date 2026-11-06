/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockClaimInsert = jest.fn();
const mockClaimDelete = jest.fn();
const mockSync = jest.fn();

jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => {
        const del = { eq: () => del, then: (r: (v: unknown) => void) => r(mockClaimDelete()) };
        return {
          insert: (rows: unknown) => Promise.resolve(mockClaimInsert(rows)),
          delete: () => del,
        };
      },
    },
  }),
}));
jest.mock("@/lib/ghl", () => ({
  syncSignupContactToGhl: (...a: unknown[]) => mockSync(...a),
}));
jest.mock("@/lib/ghl-events", () => ({
  getSignupTrialEndDate: jest.fn().mockResolvedValue("2026-11-12T20:00:00.000Z"),
}));

import { POST } from "../route";

const env = process.env as Record<string, string | undefined>;
const originalUrl = env.GHL_SIGNUP_WEBHOOK_URL;

function signupLookup(rows: { id: string }[]) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ rows }),
  });
}

function request(body: object) {
  return new NextRequest("https://app.example.test/api/auth/sync-ghl-contact", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const body = { email: "new@example.test", fullName: "New Owner" };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  env.GHL_SIGNUP_WEBHOOK_URL = "https://ghl.example.test/hook";
  mockClaimInsert.mockReturnValue({ error: null });
  mockSync.mockResolvedValue(null);
  signupLookup([{ id: "user-1" }]);
});

afterAll(() => {
  env.GHL_SIGNUP_WEBHOOK_URL = originalUrl;
});

describe("POST /api/auth/sync-ghl-contact", () => {
  it("rejects emails that are not a recent signup", async () => {
    signupLookup([]);
    const res = await POST(request(body));
    expect(res.status).toBe(403);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("sends the sign-up event once, claimed per account", async () => {
    const res = await POST(request(body));
    expect(await res.json()).toEqual({ synced: true });
    expect(mockClaimInsert).toHaveBeenCalledWith([
      { user_id: "user-1", kind: "ghl_signup", ref: "signup" },
    ]);
    expect(mockSync).toHaveBeenCalledWith({
      email: "new@example.test",
      fullName: "New Owner",
      trialEndDate: "2026-11-12T20:00:00.000Z",
    });
  });

  it("skips a repeat call so GHL doesn't re-run the sign-up workflow", async () => {
    mockClaimInsert.mockReturnValue({ error: { code: "23505" } });
    const res = await POST(request(body));
    expect(await res.json()).toEqual({ synced: false, skipped: "already_sent" });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("releases the claim when GHL fails, so a retry can send it", async () => {
    mockSync.mockResolvedValue("Go High Level webhook returned 500");
    const res = await POST(request(body));
    expect(res.status).toBe(502);
    expect(mockClaimDelete).toHaveBeenCalled();
  });

  it("does not claim anything when the webhook URL is unset", async () => {
    delete env.GHL_SIGNUP_WEBHOOK_URL;
    const res = await POST(request(body));
    expect(await res.json()).toEqual({ synced: false, skipped: "not_configured" });
    expect(mockClaimInsert).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
  });
});
