import { changeTone } from "@/lib/financial-periods";

/**
 * ▲/▼ percentage, green when the change is good for the business and red when
 * it is not (a rise in expenses is red). "—" when there is nothing to compare.
 */
export function ChangeBadge({
  change,
  higherIsBetter,
  className = "",
}: {
  change: number | null;
  higherIsBetter: boolean;
  className?: string;
}) {
  if (change === null) return <span className={`text-text-muted ${className}`}>—</span>;
  const tone = changeTone(change, higherIsBetter);
  const color = tone === "good" ? "text-success" : tone === "bad" ? "text-error" : "text-text-muted";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";
  return (
    <span className={`font-medium ${color} ${className}`} data-tone={tone}>
      {arrow} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
