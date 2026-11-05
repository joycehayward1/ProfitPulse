import {
  addMonths,
  availableYears,
  balanceAsOf,
  changeTone,
  describeAverage,
  flowValue,
  lastDayOfMonth,
  latestMonth,
  listMonths,
  monthLabel,
  monthlyTrend,
  monthRangeLabel,
  normalizeMonthly,
  percentChange,
  previousMonth,
  priorYearSamePeriod,
  isComparablePeriod,
  describeIncomparable,
  recentMonthlyAverage,
  sameMonthLastYear,
  summarizePeriod,
  toMonthKey,
  yearToDate,
} from "@/lib/financial-periods";
import { NOV_5_2026, sampleSnapshots, snapshot } from "@/lib/test-fixtures/sample-months";

describe("month keys and labels", () => {
  it("reads ISO dates from their digits so the 1st never slips into the previous month", () => {
    expect(toMonthKey("2026-04-01")).toBe("2026-04");
    expect(toMonthKey("2026-04-30")).toBe("2026-04");
    expect(toMonthKey("2026-04-01T00:00:00Z")).toBe("2026-04");
    expect(toMonthKey("2026-4")).toBe("2026-04");
    expect(toMonthKey("April 2026")).toBe("2026-04");
  });

  it("rejects missing or impossible dates", () => {
    expect(toMonthKey(null)).toBeNull();
    expect(toMonthKey("")).toBeNull();
    expect(toMonthKey("2026-13-01")).toBeNull();
    expect(toMonthKey("not a date")).toBeNull();
  });

  it("moves across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-04", -12)).toBe("2025-04");
    expect(addMonths("2026-04", -16)).toBe("2024-12");
  });

  it("knows the last day of each month, including leap years", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-04")).toBe("2026-04-30");
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
  });

  it("labels months and ranges", () => {
    expect(monthLabel("2026-04")).toBe("April 2026");
    expect(monthLabel("2026-04", "short")).toBe("Apr 26");
    expect(monthRangeLabel("2026-01", "2026-04")).toBe("January–April 2026");
    expect(monthRangeLabel("2025-11", "2026-02")).toBe("November 2025–February 2026");
    expect(monthRangeLabel("2026-04", "2026-04")).toBe("April 2026");
    expect(listMonths(["2026-01", "2026-03"])).toBe("January 2026 and March 2026");
  });
});

describe("normalizeMonthly", () => {
  const data = normalizeMonthly(sampleSnapshots(), NOV_5_2026);

  it("keeps one row per month, choosing the most recent save", () => {
    const april = data.months.find((m) => m.month === "2026-04");
    expect(april?.snapshot.total_income).toBe(25000);
    expect(april?.ignoredDuplicates).toBe(1);
    expect(data.duplicateMonths).toEqual(["2026-04"]);
    expect(data.months.map((m) => m.month)).toEqual(["2025-04", "2025-12", "2026-02", "2026-03", "2026-04"]);
  });

  it("leaves out months dated after the current month", () => {
    expect(data.futureMonths).toEqual(["2027-06"]);
    expect(latestMonth(data)?.month).toBe("2026-04");
  });

  it("keeps the current month itself", () => {
    const current = normalizeMonthly([snapshot("2026-11-01", 1, 1)], NOV_5_2026);
    expect(current.months.map((m) => m.month)).toEqual(["2026-11"]);
  });

  it("prefers the later save even if it was dated on a different day", () => {
    const rows = [
      snapshot("2026-04-30", 1000, 500, { created_at: "2026-05-01T00:00:00Z" }),
      snapshot("2026-04-01", 2000, 500, { data_source: "manual", created_at: "2026-06-01T00:00:00Z" }),
    ];
    expect(latestMonth(normalizeMonthly(rows, NOV_5_2026))?.snapshot.total_income).toBe(2000);
  });

  it("does not change the rows it was given", () => {
    const rows = sampleSnapshots();
    const before = JSON.stringify(rows);
    normalizeMonthly(rows, NOV_5_2026);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

describe("year to date", () => {
  const data = normalizeMonthly(sampleSnapshots(), NOV_5_2026);

  it("adds up January through the latest saved month of the year", () => {
    const ytd = yearToDate(data, 2026)!;
    expect(ytd.label).toBe("January–April 2026");
    expect(ytd.totals.total_income).toBe(70500);
    expect(ytd.totals.total_expenses).toBe(57500);
    expect(ytd.totals.net_profit).toBe(13000);
    expect(ytd.netMargin).toBeCloseTo(13000 / 70500, 10);
    expect(ytd.monthsWithData).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(ytd.missingMonths).toEqual(["2026-01"]);
  });

  it("never lets another year's months in", () => {
    const ytd = yearToDate(data, 2026)!;
    expect(ytd.totals.total_income).not.toBe(70500 + 24000);
    const y2025 = yearToDate(data, 2025)!;
    expect(y2025.label).toBe("January–December 2025");
    expect(y2025.totals.total_income).toBe(44000);
    expect(yearToDate(data, 2027)).toBeNull();
  });

  it("can stop at a chosen month", () => {
    const ytd = yearToDate(data, 2026, "2026-03")!;
    expect(ytd.end).toBe("2026-03");
    expect(ytd.totals.total_income).toBe(45500);
  });

  it("does not add up balances: cash is read as of the last month", () => {
    expect(balanceAsOf(data, "current_assets")).toEqual({ value: 44000, month: "2026-04" });
    expect(balanceAsOf(data, "current_assets", "2026-03")).toEqual({ value: 42500, month: "2026-03" });
    expect(balanceAsOf(data, "equity")).toEqual({ value: null, month: null });
  });

  it("compares with the same months a year earlier, reporting how many were saved", () => {
    const prior = priorYearSamePeriod(data, yearToDate(data, 2026)!)!;
    expect(prior.label).toBe("January–April 2025");
    expect(prior.totals.total_income).toBe(20000);
    expect(prior.monthsWithData).toEqual(["2025-04"]);
  });

  it("only treats two periods as comparable when the same months are saved", () => {
    const ytd = yearToDate(data, 2026)!;
    const prior = priorYearSamePeriod(data, ytd);
    expect(isComparablePeriod(ytd, prior)).toBe(false);
    expect(describeIncomparable(ytd, prior, "January–April 2025")).toBe(
      "January–April 2025 has 1 of 4 months saved, not the same months as January–April 2026"
    );
    expect(isComparablePeriod(ytd, null)).toBe(false);
    expect(describeIncomparable(ytd, null, "January–April 2025")).toBe("nothing saved for January–April 2025");

    const both = normalizeMonthly(
      [
        snapshot("2025-02-28", 15000, 12000),
        snapshot("2025-03-31", 16000, 12500),
        snapshot("2026-02-28", 22000, 18000),
        snapshot("2026-03-31", 23500, 18500),
      ],
      NOV_5_2026
    );
    const current = yearToDate(both, 2026)!;
    expect(isComparablePeriod(current, priorYearSamePeriod(both, current))).toBe(true);
  });

  it("reports the year-to-date figures the owner typed on the last month", () => {
    const rows = [snapshot("2026-03-31", 10000, 8000, { ytd_revenue: 31000, ytd_expenses: 25000 })];
    const ytd = yearToDate(normalizeMonthly(rows, NOV_5_2026), 2026)!;
    expect(ytd.stated).toEqual({ revenue: 31000, expenses: 25000, month: "2026-03" });
    expect(ytd.totals.total_income).toBe(10000);
  });

  it("lists years newest first", () => {
    expect(availableYears(data)).toEqual([2026, 2025]);
  });

  it("handles losses and zero income", () => {
    const rows = [snapshot("2026-01-31", 0, 3000), snapshot("2026-02-28", 1000, 4000)];
    const ytd = yearToDate(normalizeMonthly(rows, NOV_5_2026), 2026)!;
    expect(ytd.totals.net_profit).toBe(-6000);
    expect(ytd.netMargin).toBe(-6);
    const zero = summarizePeriod(normalizeMonthly(rows, NOV_5_2026), "2026-01", "2026-01");
    expect(zero.netMargin).toBeNull();
  });

  it("leaves a total empty when no month has the figure, instead of showing $0", () => {
    const ytd = yearToDate(data, 2026)!;
    expect(ytd.totals.gross_profit).toBeNull();
    expect(ytd.monthCounts.gross_profit).toBe(0);
  });

  it("works out net profit from income and expenses when it wasn't saved", () => {
    expect(flowValue(snapshot("2026-01-31", 5000, 3500, { net_profit: null }), "net_profit")).toBe(1500);
  });
});

describe("comparisons", () => {
  const data = normalizeMonthly(sampleSnapshots(), NOV_5_2026);

  it("compares with the calendar month before, even when it wasn't saved", () => {
    expect(previousMonth(data, "2026-04").record?.snapshot.total_income).toBe(23500);
    const feb = previousMonth(data, "2026-02");
    expect(feb.month).toBe("2026-01");
    expect(feb.record).toBeNull();
    expect(previousMonth(data, "2026-01").month).toBe("2025-12");
  });

  it("finds the same month last year", () => {
    expect(sameMonthLastYear(data, "2026-04").record?.snapshot.total_income).toBe(20000);
  });

  it("returns no percentage when the earlier value is zero or missing", () => {
    expect(percentChange(25000, 23500)).toBeCloseTo(6.383, 3);
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, null)).toBeNull();
    expect(percentChange(null, 100)).toBeNull();
    expect(percentChange(-1000, -2000)).toBe(50);
  });

  it("colours a rise in expenses as bad and a rise in income as good", () => {
    expect(changeTone(13.5, false)).toBe("bad");
    expect(changeTone(-5, false)).toBe("good");
    expect(changeTone(6.4, true)).toBe("good");
    expect(changeTone(-20, true)).toBe("bad");
    expect(changeTone(0, true)).toBe("neutral");
    expect(changeTone(null, false)).toBe("neutral");
  });
});

describe("trend and averages", () => {
  const data = normalizeMonthly(sampleSnapshots(), NOV_5_2026);

  it("returns consecutive months with gaps for unsaved ones", () => {
    const trend = monthlyTrend(data, "2026-04", 6);
    expect(trend.map((p) => p.label)).toEqual(["Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26"]);
    expect(trend.map((p) => p.income)).toEqual([null, 24000, null, 22000, 23500, 25000]);
  });

  it("averages the latest saved months, keeping cents", () => {
    const avg = recentMonthlyAverage(data, "total_expenses");
    expect(avg.months).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(avg.value).toBeCloseTo(19166.6667, 3);
    expect(describeAverage(avg)).toBe("average of February–April 2026 (3 months)");
  });

  it("skips gaps instead of counting them as zero", () => {
    const rows = [snapshot("2026-01-31", 1000, 900), snapshot("2026-03-31", 3000, 1500)];
    const avg = recentMonthlyAverage(normalizeMonthly(rows, NOV_5_2026), "total_income");
    expect(avg.value).toBe(2000);
    expect(describeAverage(avg)).toBe("average of January 2026 and March 2026 (2 months)");
  });

  it("ignores months more than a year before the latest one", () => {
    const rows = [snapshot("2024-01-31", 9000, 1), snapshot("2026-03-31", 3000, 1)];
    const avg = recentMonthlyAverage(normalizeMonthly(rows, NOV_5_2026), "total_income");
    expect(avg.value).toBe(3000);
    expect(describeAverage(avg)).toBe("March 2026 only");
  });

  it("returns nothing when there are no months", () => {
    const avg = recentMonthlyAverage(normalizeMonthly([], NOV_5_2026), "total_income");
    expect(avg).toEqual({ value: null, months: [] });
    expect(describeAverage(avg)).toBe("");
  });
});
