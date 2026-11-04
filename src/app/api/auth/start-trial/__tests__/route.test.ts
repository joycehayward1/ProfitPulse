/** @jest-environment node */
import { NextRequest } from "next/server";

const mockSendTrialUpdated = jest.fn();
let existing: Record<string, unknown> | null = null;
let insertError: unknown = null;
let insertedRow: Record<string, unknown> | null = null;

jest.mock("@/lib/ghl-events", () => ({
  sendGhlTrialUpdatedEvent: (...a: unknown[]) => mockSendTrialUpdated(...a),
}));
jest.mock("@/lib/server-auth", () => ({ getAuthenticatedUserId: async () => "user-1" }));
jest.mock("@/lib/insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing }) }) }),
        insert: (row: Record<string, unknown>) => {
          insertedRow = row;
          return {
            select: () => ({
              single: () => Promise.resolve({ data: insertError ? null : row, error: insertError }),
            }),
          };
        },
      }),
    },
  }),
}));

import { POST } from "../route";

const request = () => new NextRequest("http://localhost/api/auth/start-trial", { method: "POST", body: "{}" });
const originalFetch = global.fetch;

describe("POST /api/auth/start-trial GHL trial update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    existing = null;
    insertError = null;
    insertedRow = null;
    delete process.env.NEXT_PUBLIC_INSFORGE_URL;
    delete process.env.INSFORGE_API_KEY;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sends trial_updated with the real trial end when the trial row is created", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mockSendTrialUpdated).toHaveBeenCalledTimes(1);
    const [userId, sentDate] = mockSendTrialUpdated.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(new Date(sentDate).toISOString()).toBe(insertedRow?.trial_end_date);
  });

  it("sends nothing on later loads, when the row already exists", async () => {
    existing = { user_id: "user-1", trial_end_date: "2026-11-11T00:00:00Z" };
    const res = await POST(request());
    expect((await res.json()).created).toBe(false);
    expect(mockSendTrialUpdated).not.toHaveBeenCalled();
  });

  it("sends nothing when the insert fails", async () => {
    insertError = { message: "duplicate key" };
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(mockSendTrialUpdated).not.toHaveBeenCalled();
  });

  it("sends nothing for comped users, who get Pro instead of a trial", async () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://db.example.com";
    process.env.INSFORGE_API_KEY = "key";
    global.fetch = jest.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      const sql = JSON.parse(init.body).query as string;
      const rows = sql.includes("FROM comped_emails") ? [{ email: "vip@x.co", access_months: null }] : [];
      return { ok: true, json: async () => ({ rows }) };
    }) as unknown as typeof fetch;

    const res = await POST(request());
    expect((await res.json()).comped).toBe(true);
    expect(mockSendTrialUpdated).not.toHaveBeenCalled();
  });
});
