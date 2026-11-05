import type { FinancialSnapshot } from "@/lib/database.types";

/**
 * Month-based view of saved financial data. Every date rule used by the
 * dashboard, reports and calculators lives here so they all agree.
 *
 * Rules (owner sign-off needed before production, see docs/YTD_REPORTING.md):
 * - A period is a calendar month ("YYYY-MM"), whatever day it was saved on
 *   (manual entry uses the 1st, uploads the last day, QuickBooks its end date).
 * - If a month was saved more than once, the most recently saved row is used.
 *   Nothing is deleted or rewritten; the other rows are only reported.
 * - Months after the current month are left out of every total.
 * - Year to date is January to the latest saved month of a calendar year.
 * - Flow figures (income, expenses, profit, cash flow) are added up across
 *   months. Balance figures (cash, assets, liabilities, equity, receivables)
 *   are never added up: they are read as of the latest month that has them.
 * - "Monthly" estimates are averages of recent saved months, never a total.
 */

export type MonthKey = string;

export const FLOW_FIELDS = [
  "total_income",
  "gross_profit",
  "total_expenses",
  "net_operating_income",
  "net_profit",
  "operating_activities",
  "investing_activities",
  "financing_activities",
  "net_cash_flow",
] as const;
export type FlowField = (typeof FLOW_FIELDS)[number];

export const BALANCE_FIELDS = [
  "current_assets",
  "fixed_assets",
  "total_assets",
  "current_liabilities",
  "long_term_liabilities",
  "equity",
  "accounts_receivable",
  "inventory_value",
  "working_capital",
] as const;
export type BalanceField = (typeof BALANCE_FIELDS)[number];

/** Months used for the "recent monthly average" behind calculator defaults. */
export const TRAILING_AVERAGE_MONTHS = 3;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isValidMonth(year: number, month: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 9999 && month >= 1 && month <= 12;
}

function makeKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Month key for a year and month number (1–12). */
export const makeMonthKey = makeKey;

/**
 * Calendar month of a saved period or user-supplied date. ISO-style strings
 * are read from their digits, so "2026-04-01" is April in every time zone.
 */
export function toMonthKey(input: string | null | undefined): MonthKey | null {
  if (!input) return null;
  const raw = input.trim();
  const iso = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T\s].*)?$/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    return isValidMonth(year, month) ? makeKey(year, month) : null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return makeKey(parsed.getFullYear(), parsed.getMonth() + 1);
}

/** The month a date falls in, in the viewer's local time. */
export function monthKeyOf(date: Date): MonthKey {
  return makeKey(date.getFullYear(), date.getMonth() + 1);
}

export function yearOf(key: MonthKey): number {
  return Number(key.slice(0, 4));
}

/** 1 for January … 12 for December. */
export function monthNumberOf(key: MonthKey): number {
  return Number(key.slice(5, 7));
}

export function addMonths(key: MonthKey, count: number): MonthKey {
  const index = yearOf(key) * 12 + (monthNumberOf(key) - 1) + count;
  return makeKey(Math.floor(index / 12), (index % 12) + 1);
}

/** Every month from `start` to `end`, inclusive. Empty if end is before start. */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let key = start; key <= end; key = addMonths(key, 1)) months.push(key);
  return months;
}

/** Last day of the month as "YYYY-MM-DD" (the period_date uploads save). */
export function lastDayOfMonth(key: MonthKey): string {
  const day = new Date(Date.UTC(yearOf(key), monthNumberOf(key), 0)).getUTCDate();
  return `${key}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(key: MonthKey, style: "long" | "short" = "long"): string {
  const name = MONTH_NAMES[monthNumberOf(key) - 1];
  return style === "long" ? `${name} ${yearOf(key)}` : `${name.slice(0, 3)} ${String(yearOf(key)).slice(2)}`;
}

/** "January–April 2026", "April 2026", or "November 2025–February 2026". */
export function monthRangeLabel(start: MonthKey, end: MonthKey): string {
  if (start === end) return monthLabel(start);
  const startName = MONTH_NAMES[monthNumberOf(start) - 1];
  if (yearOf(start) === yearOf(end)) return `${startName}–${monthLabel(end)}`;
  return `${monthLabel(start)}–${monthLabel(end)}`;
}

/** "March 2026", "March and May 2026", "March, May and June 2026". */
export function listMonths(keys: MonthKey[]): string {
  const labels = keys.map((k) => monthLabel(k));
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export interface MonthlyRecord {
  month: MonthKey;
  snapshot: FinancialSnapshot;
  /** Other saved rows for the same month that were not used. */
  ignoredDuplicates: number;
}

export interface MonthlyData {
  /** One record per month, oldest first, future months left out. */
  months: MonthlyRecord[];
  /** Months saved more than once (the latest save is used). */
  duplicateMonths: MonthKey[];
  /** Months dated after the current month, left out of every figure. */
  futureMonths: MonthKey[];
}

function savedAt(s: FinancialSnapshot): number {
  const t = Date.parse(s.created_at ?? "");
  return Number.isNaN(t) ? 0 : t;
}

export function normalizeMonthly(
  snapshots: FinancialSnapshot[],
  now: Date = new Date()
): MonthlyData {
  const currentMonth = monthKeyOf(now);
  const byMonth = new Map<MonthKey, FinancialSnapshot[]>();
  for (const s of snapshots) {
    const key = toMonthKey(s.period_date);
    if (!key) continue;
    const list = byMonth.get(key) ?? [];
    list.push(s);
    byMonth.set(key, list);
  }

  const months: MonthlyRecord[] = [];
  const duplicateMonths: MonthKey[] = [];
  const futureMonths: MonthKey[] = [];
  for (const [month, rows] of Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (month > currentMonth) {
      futureMonths.push(month);
      continue;
    }
    const [chosen] = [...rows].sort(
      (a, b) => savedAt(b) - savedAt(a) || (b.period_date ?? "").localeCompare(a.period_date ?? "")
    );
    if (rows.length > 1) duplicateMonths.push(month);
    months.push({ month, snapshot: chosen, ignoredDuplicates: rows.length - 1 });
  }
  return { months, duplicateMonths, futureMonths };
}

export function latestMonth(data: MonthlyData): MonthlyRecord | null {
  return data.months[data.months.length - 1] ?? null;
}

export function recordFor(data: MonthlyData, key: MonthKey): MonthlyRecord | null {
  return data.months.find((m) => m.month === key) ?? null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A flow figure for one month. Net profit falls back to income minus expenses. */
export function flowValue(s: FinancialSnapshot, field: FlowField): number | null {
  const value = finite(s[field]);
  if (value !== null || field !== "net_profit") return value;
  const income = finite(s.total_income);
  const expenses = finite(s.total_expenses);
  return income !== null && expenses !== null ? income - expenses : null;
}

export interface BalanceAsOf {
  value: number | null;
  /** Month the balance comes from, or null if no month has it. */
  month: MonthKey | null;
}

/** A balance figure as of `through`: the latest month up to then that has it. */
export function balanceAsOf(
  data: MonthlyData,
  field: BalanceField,
  through?: MonthKey
): BalanceAsOf {
  for (let i = data.months.length - 1; i >= 0; i--) {
    const { month, snapshot } = data.months[i];
    if (through && month > through) continue;
    const value = finite(snapshot[field]);
    if (value !== null) return { value, month };
  }
  return { value: null, month: null };
}

export interface PeriodSummary {
  start: MonthKey;
  end: MonthKey;
  label: string;
  monthsInRange: MonthKey[];
  monthsWithData: MonthKey[];
  missingMonths: MonthKey[];
  /** Sum of each flow figure over the months that have it; null if none do. */
  totals: Record<FlowField, number | null>;
  /** How many months contributed to each total. */
  monthCounts: Record<FlowField, number>;
  /** Net profit ÷ income for the period; null when income is zero or missing. */
  netMargin: number | null;
  grossMargin: number | null;
  /** YTD revenue/expenses the owner typed on the period's last month, if any. */
  stated: { revenue: number | null; expenses: number | null; month: MonthKey } | null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

export function summarizePeriod(data: MonthlyData, start: MonthKey, end: MonthKey): PeriodSummary {
  const monthsInRange = monthRange(start, end);
  const inRange = data.months.filter((m) => m.month >= start && m.month <= end);
  const totals = {} as Record<FlowField, number | null>;
  const monthCounts = {} as Record<FlowField, number>;
  for (const field of FLOW_FIELDS) {
    let total: number | null = null;
    let count = 0;
    for (const { snapshot } of inRange) {
      const value = flowValue(snapshot, field);
      if (value === null) continue;
      total = (total ?? 0) + value;
      count++;
    }
    totals[field] = total;
    monthCounts[field] = count;
  }

  const withData = new Set(inRange.map((m) => m.month));
  const last = inRange.find((m) => m.month === end)?.snapshot;
  const statedRevenue = last ? finite(last.ytd_revenue) : null;
  const statedExpenses = last ? finite(last.ytd_expenses) : null;
  const hasStated = (statedRevenue ?? 0) > 0 || (statedExpenses ?? 0) > 0;

  return {
    start,
    end,
    label: monthRangeLabel(start, end),
    monthsInRange,
    monthsWithData: monthsInRange.filter((m) => withData.has(m)),
    missingMonths: monthsInRange.filter((m) => !withData.has(m)),
    totals,
    monthCounts,
    netMargin: ratio(totals.net_profit, totals.total_income),
    grossMargin: ratio(totals.gross_profit, totals.total_income),
    stated: hasStated
      ? { revenue: statedRevenue || null, expenses: statedExpenses || null, month: end }
      : null,
  };
}

/** Calendar years that have saved months, newest first. */
export function availableYears(data: MonthlyData): number[] {
  return Array.from(new Set(data.months.map((m) => yearOf(m.month)))).sort((a, b) => b - a);
}

/**
 * January to date for `year`: January through the latest saved month of that
 * year (or through `through`, if earlier). Null when the year has no saved
 * months up to then. Other years never contribute.
 */
export function yearToDate(data: MonthlyData, year: number, through?: MonthKey): PeriodSummary | null {
  const yearEnd = makeKey(year, 12);
  const limit = through && through < yearEnd ? through : yearEnd;
  const inYear = data.months.filter((m) => yearOf(m.month) === year && m.month <= limit);
  if (inYear.length === 0) return null;
  return summarizePeriod(data, makeKey(year, 1), inYear[inYear.length - 1].month);
}

/** The same months one year earlier, for a like-for-like comparison. */
export function priorYearSamePeriod(data: MonthlyData, period: PeriodSummary): PeriodSummary | null {
  const start = addMonths(period.start, -12);
  const end = addMonths(period.end, -12);
  if (!data.months.some((m) => m.month >= start && m.month <= end)) return null;
  return summarizePeriod(data, start, end);
}

/**
 * True when every month saved in `current` has its counterpart saved in
 * `earlier` (same position in the range), so the totals cover the same months
 * and a percentage change between them means something.
 */
export function isComparablePeriod(current: PeriodSummary, earlier: PeriodSummary | null): boolean {
  if (!earlier || current.monthsWithData.length === 0) return false;
  if (current.monthsInRange.length !== earlier.monthsInRange.length) return false;
  const saved = new Set(earlier.monthsWithData);
  return current.monthsInRange.every(
    (month, i) => !current.monthsWithData.includes(month) || saved.has(earlier.monthsInRange[i])
  );
}

/** "only 1 of 4 months saved in January–April 2025" — why two periods weren't compared. */
export function describeIncomparable(current: PeriodSummary, earlier: PeriodSummary | null, earlierLabel: string): string {
  const saved = earlier?.monthsWithData.length ?? 0;
  const total = earlier?.monthsInRange.length ?? current.monthsInRange.length;
  if (saved === 0) return `nothing saved for ${earlierLabel}`;
  return `${earlierLabel} has ${saved} of ${total} months saved, not the same months as ${current.label}`;
}

/**
 * Percentage change. Null when either side is missing or the earlier value is
 * zero (no meaningful percentage). Measured against the size of the earlier
 * value, so a loss shrinking from -$2,000 to -$1,000 is +50%.
 */
export function percentChange(current: number | null | undefined, prior: number | null | undefined): number | null {
  const c = finite(current);
  const p = finite(prior);
  if (c === null || p === null || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

export type ChangeTone = "good" | "bad" | "neutral";

/** Green or red for a change, given whether a rise is good (income) or bad (expenses). */
export function changeTone(change: number | null, higherIsBetter: boolean): ChangeTone {
  if (change === null || change === 0) return "neutral";
  return change > 0 === higherIsBetter ? "good" : "bad";
}

export interface MonthComparison {
  /** The calendar month compared against (exists even if nothing was saved). */
  month: MonthKey;
  record: MonthlyRecord | null;
}

/** The month immediately before `key`, which may not have been saved. */
export function previousMonth(data: MonthlyData, key: MonthKey): MonthComparison {
  const month = addMonths(key, -1);
  return { month, record: recordFor(data, month) };
}

export function sameMonthLastYear(data: MonthlyData, key: MonthKey): MonthComparison {
  const month = addMonths(key, -12);
  return { month, record: recordFor(data, month) };
}

export interface TrendPoint {
  month: MonthKey;
  label: string;
  income: number | null;
  expenses: number | null;
}

/** `count` consecutive months ending at `end`; months with no data are null (gaps). */
export function monthlyTrend(data: MonthlyData, end: MonthKey, count: number): TrendPoint[] {
  return monthRange(addMonths(end, -(count - 1)), end).map((month) => {
    const s = recordFor(data, month)?.snapshot;
    return {
      month,
      label: monthLabel(month, "short"),
      income: s ? flowValue(s, "total_income") : null,
      expenses: s ? flowValue(s, "total_expenses") : null,
    };
  });
}

export interface MonthlyAverage {
  value: number | null;
  /** Months averaged, oldest first. */
  months: MonthKey[];
}

/**
 * Average of a flow figure over the most recent saved months that have it
 * (up to TRAILING_AVERAGE_MONTHS), within the 12 months ending at the latest
 * saved month. Gaps are skipped, not counted as zero.
 */
export function recentMonthlyAverage(
  data: MonthlyData,
  field: FlowField,
  maxMonths: number = TRAILING_AVERAGE_MONTHS
): MonthlyAverage {
  const latest = latestMonth(data);
  if (!latest) return { value: null, months: [] };
  const windowStart = addMonths(latest.month, -11);
  const picked: { month: MonthKey; value: number }[] = [];
  for (let i = data.months.length - 1; i >= 0 && picked.length < maxMonths; i--) {
    const { month, snapshot } = data.months[i];
    if (month < windowStart) break;
    const value = flowValue(snapshot, field);
    if (value !== null) picked.push({ month, value });
  }
  if (picked.length === 0) return { value: null, months: [] };
  const sum = picked.reduce((acc, p) => acc + p.value, 0);
  return { value: sum / picked.length, months: picked.map((p) => p.month).reverse() };
}

/** "average of February–April 2026 (3 months)" or "April 2026 only". */
export function describeAverage(avg: MonthlyAverage): string {
  if (avg.months.length === 0) return "";
  if (avg.months.length === 1) return `${monthLabel(avg.months[0])} only`;
  const first = avg.months[0];
  const last = avg.months[avg.months.length - 1];
  const contiguous = monthRange(first, last).length === avg.months.length;
  const span = contiguous ? monthRangeLabel(first, last) : listMonths(avg.months);
  return `average of ${span} (${avg.months.length} months)`;
}
