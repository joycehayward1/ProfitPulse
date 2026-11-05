import { lastDayOfMonth, toMonthKey, type MonthKey } from "@/lib/financial-periods";

export interface UploadPeriodResult<T> {
  /** One row per month, dated the last day of that month. */
  rows: T[];
  /** Months that appeared more than once in the upload; the last one is kept. */
  duplicateMonths: MonthKey[];
}

/**
 * Dates every uploaded month on its last day (read from the date's digits, so
 * time zones can't move it into the previous month) and keeps one row per
 * month — saving two rows for the same month in one request would fail.
 * Rows whose date can't be read are kept unchanged.
 */
export function normalizeUploadPeriods<T extends { period_date: string | null }>(snapshots: T[]): UploadPeriodResult<T> {
  const byMonth = new Map<MonthKey, T>();
  const unreadable: T[] = [];
  const duplicates = new Set<MonthKey>();
  for (const snap of snapshots) {
    const key = toMonthKey(snap.period_date);
    if (!key) {
      unreadable.push(snap);
      continue;
    }
    if (byMonth.has(key)) {
      duplicates.add(key);
      byMonth.delete(key);
    }
    byMonth.set(key, { ...snap, period_date: lastDayOfMonth(key) });
  }
  return {
    rows: [...Array.from(byMonth.values()), ...unreadable],
    duplicateMonths: Array.from(duplicates).sort(),
  };
}
