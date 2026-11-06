import { normalizeUploadPeriods } from "@/lib/upload-periods";

describe("normalizeUploadPeriods", () => {
  it("dates each month on its last day without shifting it into the previous month", () => {
    const { rows } = normalizeUploadPeriods([
      { period_date: "2026-04-01", total_income: 1 },
      { period_date: "2026-02-15", total_income: 2 },
      { period_date: "March 2026", total_income: 3 },
    ]);
    expect(rows.map((r) => r.period_date)).toEqual(["2026-04-30", "2026-02-28", "2026-03-31"]);
  });

  it("keeps the last row when a month appears twice and reports it", () => {
    const { rows, duplicateMonths } = normalizeUploadPeriods([
      { period_date: "2026-04-01", total_income: 1 },
      { period_date: "2026-03-31", total_income: 2 },
      { period_date: "2026-04-30", total_income: 3 },
    ]);
    expect(rows).toEqual([
      { period_date: "2026-03-31", total_income: 2 },
      { period_date: "2026-04-30", total_income: 3 },
    ]);
    expect(duplicateMonths).toEqual(["2026-04"]);
  });

  it("keeps rows with an unreadable date unchanged", () => {
    const { rows } = normalizeUploadPeriods([{ period_date: null, total_income: 1 }]);
    expect(rows).toEqual([{ period_date: null, total_income: 1 }]);
  });

  it("handles year boundaries", () => {
    const { rows } = normalizeUploadPeriods([{ period_date: "2025-12-01" }, { period_date: "2026-01-01" }]);
    expect(rows.map((r) => r.period_date)).toEqual(["2025-12-31", "2026-01-31"]);
  });
});
