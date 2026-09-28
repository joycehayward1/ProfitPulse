const mockSend = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockAdminSql = jest.fn();
let trialRows: { user_id: string; trial_end_date: string }[] = [];

jest.mock("../resend", () => ({
  getResend: () => ({ emails: { send: (...a: unknown[]) => mockSend(...a) } }),
  FROM_EMAIL: "from@example.com",
  REPLY_TO_EMAIL: "reply@example.com",
}));
jest.mock("../admin-log", () => ({ adminSql: (...a: unknown[]) => mockAdminSql(...a) }));
jest.mock("../insforge", () => ({
  getInsForgeAdmin: () => ({
    database: {
      from: (table: string) => {
        if (table === "email_log") {
          const del = { eq: () => del, then: (r: (v: unknown) => void) => r(mockDelete()) };
          return {
            insert: (rows: unknown) => Promise.resolve(mockInsert(rows)),
            delete: () => del,
          };
        }
        const chain = {
          select: () => chain,
          eq: () => chain,
          not: () => Promise.resolve({ data: trialRows, error: null }),
        };
        return chain;
      },
    },
  }),
}));

import { sendLifecycleEmailOnce, sendTrialEmails, paymentDeclinedEmail } from "../lifecycle-emails";

const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockReturnValue({ error: null });
  mockSend.mockResolvedValue({});
  mockAdminSql.mockResolvedValue([{ email: "customer@example.com" }]);
  trialRows = [];
});

const email = { userId: "u1", kind: "trial_ended" as const, ref: "r1", to: "a@b.com", subject: "s", html: "h" };

describe("sendLifecycleEmailOnce", () => {
  it("sends when the log row is claimed", async () => {
    expect(await sendLifecycleEmailOnce(email)).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("skips when it was already sent", async () => {
    mockInsert.mockReturnValue({ error: { code: "23505" } });
    expect(await sendLifecycleEmailOnce(email)).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("releases the claim when the send fails, so the next run retries", async () => {
    mockSend.mockRejectedValue(new Error("resend down"));
    expect(await sendLifecycleEmailOnce(email)).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe("sendTrialEmails", () => {
  it("reminds trials ending within 60 hours and emails trials that just ended", async () => {
    trialRows = [
      { user_id: "ending", trial_end_date: inHours(40) },
      { user_id: "ended", trial_end_date: inHours(-10) },
      { user_id: "later", trial_end_date: inHours(120) },
      { user_id: "long-ago", trial_end_date: inHours(-200) },
    ];
    const sent = await sendTrialEmails();
    expect(sent).toEqual({ ending: 1, ended: 1 });
    const subjects = mockSend.mock.calls.map((c) => (c[0] as { subject: string }).subject);
    expect(subjects).toEqual([
      "Your MyProfitPulse trial ends in 2 days",
      "Your MyProfitPulse trial has ended",
    ]);
  });

  it("skips deleted accounts", async () => {
    trialRows = [{ user_id: "gone", trial_end_date: inHours(10) }];
    mockAdminSql.mockResolvedValue([{ email: "deleted-x@deleted.invalid" }]);
    expect(await sendTrialEmails()).toEqual({ ending: 0, ended: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("paymentDeclinedEmail", () => {
  it("names the amount and links to billing", () => {
    const { subject, html } = paymentDeclinedEmail(47.99);
    expect(subject).toBe("Your MyProfitPulse payment didn't go through");
    expect(html).toContain("$47.99");
    expect(html).toContain("/billing");
  });
});
