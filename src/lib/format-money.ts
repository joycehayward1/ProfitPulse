/** "$19,166.67" — cents shown only when the amount has them. */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

/** A number for a form input, kept to the cent instead of rounded to dollars. */
export function toInputValue(amount: number): string {
  return String(Math.round(amount * 100) / 100);
}

/** "18.4%" from a ratio such as 0.184; "—" when there is no ratio. */
export function formatRatioPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}
