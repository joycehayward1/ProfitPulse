import { buildLatestMonthInsight } from "@/lib/dashboard-insight";
import { normalizeMonthly } from "@/lib/financial-periods";
import { NOV_5_2026, sampleSnapshots, snapshot } from "@/lib/test-fixtures/sample-months";

describe("buildLatestMonthInsight", () => {
  it("states only the latest month's figures against the month before", () => {
    const text = buildLatestMonthInsight(normalizeMonthly(sampleSnapshots(), NOV_5_2026));
    expect(text).toBe(
      "In April 2026 your profit margin was 16.0%, down 5.3 points from 21.3% in March 2026. " +
        "Income rose 6.4% and expenses rose 13.5% compared with March 2026."
    );
  });

  it("says there is nothing to compare when the month before isn't saved", () => {
    const data = normalizeMonthly([snapshot("2026-04-30", 25000, 21000), snapshot("2026-02-28", 22000, 18000)], NOV_5_2026);
    expect(buildLatestMonthInsight(data)).toBe(
      "In April 2026 your profit margin was 16.0%. March 2026 isn't saved, so there is nothing to compare it with yet."
    );
  });

  it("handles a loss and zero income without inventing a margin", () => {
    const data = normalizeMonthly([snapshot("2026-03-31", 0, 3000), snapshot("2026-04-30", 1000, 4000)], NOV_5_2026);
    expect(buildLatestMonthInsight(data)).toBe(
      "In April 2026 your profit margin was -300.0%. Expenses rose 33.3% compared with March 2026."
    );
  });

  it("asks for data instead of guessing when nothing is saved", () => {
    expect(buildLatestMonthInsight(normalizeMonthly([], NOV_5_2026))).toMatch(/^No insight yet/);
  });
});
