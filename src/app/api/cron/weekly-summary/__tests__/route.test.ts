/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockRun = jest.fn();
jest.mock("@/lib/weekly-summary", () => ({
  runWeeklySummary: (...a: unknown[]) => mockRun(...a),
}));

import { GET } from "../route";

const env = process.env as Record<string, string | undefined>;
const originalSecret = env.CRON_SECRET;
const originalNodeEnv = env.NODE_ENV;

function request(path = "/api/cron/weekly-summary", auth?: string) {
  return new NextRequest(`https://app.example.test${path}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  env.NODE_ENV = "production";
  env.CRON_SECRET = "test-cron-secret";
  mockRun.mockResolvedValue({ week: "2026-11-09", dryRun: false, accounts: 0, sent: 0, wouldSend: 0, failed: 0, skipped: {}, results: [] });
});

afterAll(() => {
  env.CRON_SECRET = originalSecret;
  env.NODE_ENV = originalNodeEnv;
});

describe("GET /api/cron/weekly-summary", () => {
  it("rejects requests without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request(undefined, "Bearer wrong"))).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects "Bearer undefined" when CRON_SECRET is not set', async () => {
    delete env.CRON_SECRET;
    expect((await GET(request(undefined, "Bearer undefined"))).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("runs with the cron secret", async () => {
    const res = await GET(request(undefined, "Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledWith({ dryRun: false, onlyEmail: null });
  });

  it("passes dryRun and email through for manual checks", async () => {
    await GET(request("/api/cron/weekly-summary?dryRun=1&email=owner@example.test", "Bearer test-cron-secret"));
    expect(mockRun).toHaveBeenCalledWith({ dryRun: true, onlyEmail: "owner@example.test" });
  });

  it("returns 500 when recipients can't be loaded", async () => {
    mockRun.mockResolvedValue(null);
    expect((await GET(request(undefined, "Bearer test-cron-secret"))).status).toBe(500);
  });
});
