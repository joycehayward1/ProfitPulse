const mockSendEmail = jest.fn();
const mockAdminSql = jest.fn();
const mockLogInsert = jest.fn();
const mockLogDelete = jest.fn();

let subscriptions: Record<string, unknown>[] = [];
let prefs: { user_id: string; weekly_summary: boolean }[] = [];
let assessments: Record<string, Record<string, number> | null> = {};

jest.mock("../resend", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
  FROM_EMAIL: "from@example.test",
  REPLY_TO_EMAIL: "reply@example.test",
}));
jest.mock("../admin-log", () => ({ adminSql: (...a: unknown[]) => mockAdminSql(...a) }));
jest.mock("../insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => {
        if (table === "email_log") {
          const del = { eq: () => del, then: (r: (v: unknown) => void) => r(mockLogDelete()) };
          return {
            insert: (rows: unknown) => Promise.resolve(mockLogInsert(rows)),
            delete: () => del,
          };
        }
        if (table === "subscriptions") {
          return { select: () => Promise.resolve({ data: subscriptions, error: null }) };
        }
        if (table === "notification_preferences") {
          return { select: () => Promise.resolve({ data: prefs, error: null }) };
        }
        let userId = "";
        const chain = {
          select: () => chain,
          eq: (_col: string, value: string) => {
            userId = value;
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: () => Promise.resolve({ data: assessments[userId] ?? null, error: null }),
        };
        return chain;
      },
    },
  }),
}));

import { runWeeklySummary, weekKey } from "../weekly-summary";

const activeSub = (userId: string) => ({
  user_id: userId,
  plan: "pro",
  subscription_status: "active",
  current_period_end: "2099-01-01T00:00:00Z",
  comp_days: 0,
});
const sampleAssessment = {
  cash_on_hand: 60000,
  monthly_revenue: 20000,
  monthly_expenses: 10000,
  accounts_receivable: 5000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLogInsert.mockReturnValue({ error: null });
  mockSendEmail.mockResolvedValue("email-id");
  subscriptions = [];
  prefs = [];
  assessments = {};
});

describe("weekKey", () => {
  it("is the Monday of the ISO week, in UTC", () => {
    expect(weekKey(new Date("2026-11-09T09:00:00Z"))).toBe("2026-11-09"); // Monday
    expect(weekKey(new Date("2026-11-05T20:00:00Z"))).toBe("2026-11-02"); // Thursday
    expect(weekKey(new Date("2026-11-08T23:59:00Z"))).toBe("2026-11-02"); // Sunday
  });
});

describe("runWeeklySummary", () => {
  it("returns null when recipients can't be loaded", async () => {
    mockAdminSql.mockResolvedValue(null);
    expect(await runWeeklySummary({ sendIntervalMs: 0 })).toBeNull();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends to accounts with access and an assessment, and says why the rest were skipped", async () => {
    mockAdminSql.mockResolvedValue([
      { id: "paid", email: "paid@example.test", name: "Pat Paid" },
      { id: "opted-out", email: "off@example.test", name: null },
      { id: "locked", email: "locked@example.test", name: null },
      { id: "no-data", email: "nodata@example.test", name: null },
      { id: "trial", email: "trial@example.test", name: null },
    ]);
    subscriptions = [
      activeSub("paid"),
      activeSub("opted-out"),
      activeSub("no-data"),
      { user_id: "trial", plan: "none", subscription_status: "trial", trial_end_date: "2099-01-01T00:00:00Z", comp_days: 0 },
      { user_id: "locked", plan: "none", subscription_status: "trial", trial_end_date: "2020-01-01T00:00:00Z", comp_days: 0 },
    ];
    prefs = [{ user_id: "opted-out", weekly_summary: false }];
    assessments = { paid: sampleAssessment, trial: sampleAssessment, "opted-out": sampleAssessment, locked: sampleAssessment };

    const report = await runWeeklySummary({ now: new Date("2026-11-09T09:00:00Z"), sendIntervalMs: 0 });

    expect(report).toMatchObject({
      week: "2026-11-09",
      accounts: 5,
      sent: 2,
      failed: 0,
      skipped: { opted_out: 1, no_access: 1, no_assessment: 1 },
    });
    expect(mockSendEmail.mock.calls.map((c) => c[0].to)).toEqual([
      "paid@example.test",
      "trial@example.test",
    ]);
    expect(mockLogInsert).toHaveBeenCalledWith([
      { user_id: "paid", kind: "weekly_summary", ref: "2026-11-09" },
    ]);
  });

  it("uses the dashboard's health score calculation and the first name", async () => {
    mockAdminSql.mockResolvedValue([{ id: "paid", email: "paid@example.test", name: "Pat Paid" }]);
    subscriptions = [activeSub("paid")];
    assessments = { paid: { ...sampleAssessment, health_score: 12 } };

    await runWeeklySummary({ sendIntervalMs: 0 });

    const sent = mockSendEmail.mock.calls[0][0];
    // 6 months runway (40) + 50% margin (15) + 25% receivables (22.5) = 77.5 → 78
    expect(sent.subject).toBe("MyProfitPulse Weekly Summary — Health Score: 78");
    expect(sent.html).toContain("Pat");
  });

  it("does not resend in the same week (duplicate cron delivery or manual re-run)", async () => {
    mockAdminSql.mockResolvedValue([{ id: "paid", email: "paid@example.test", name: null }]);
    subscriptions = [activeSub("paid")];
    assessments = { paid: sampleAssessment };
    mockLogInsert.mockReturnValue({ error: { code: "23505" } });

    const report = await runWeeklySummary({ sendIntervalMs: 0 });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(report?.skipped).toEqual({ already_sent: 1 });
  });

  it("counts a rejected send as failed and releases the claim for a retry", async () => {
    mockAdminSql.mockResolvedValue([{ id: "paid", email: "paid@example.test", name: null }]);
    subscriptions = [activeSub("paid")];
    assessments = { paid: sampleAssessment };
    mockSendEmail.mockRejectedValue(new Error("Resend rejected the email (rate_limit_exceeded)"));

    const report = await runWeeklySummary({ sendIntervalMs: 0 });

    expect(report).toMatchObject({ sent: 0, failed: 1 });
    expect(mockLogDelete).toHaveBeenCalled();
  });

  it("dry run reports who would get it without sending or claiming", async () => {
    mockAdminSql.mockResolvedValue([
      { id: "paid", email: "paid@example.test", name: null },
      { id: "no-data", email: "nodata@example.test", name: null },
    ]);
    subscriptions = [activeSub("paid"), activeSub("no-data")];
    assessments = { paid: sampleAssessment };

    const report = await runWeeklySummary({ dryRun: true, sendIntervalMs: 0 });

    expect(report).toMatchObject({ dryRun: true, wouldSend: 1, sent: 0, skipped: { no_assessment: 1 } });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockLogInsert).not.toHaveBeenCalled();
  });

  it("can be limited to one account by email", async () => {
    mockAdminSql.mockResolvedValue([]);
    await runWeeklySummary({ dryRun: true, onlyEmail: " Owner@Example.test ", sendIntervalMs: 0 });

    const [query, params] = mockAdminSql.mock.calls[0];
    expect(query).toContain("lower(email) = $1");
    expect(params).toEqual(["owner@example.test"]);
  });
});
