"use client";

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

function ProgressBar({ value, max, label, showPercentage = false, className = "" }: ProgressBarProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-[6px]">
          {label && (
            <span className="font-body text-small text-text-secondary">{label}</span>
          )}
          {showPercentage && (
            <span className="font-body text-small font-medium text-text-primary">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full h-2 bg-[#E8E4DF] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || "Progress"}
      >
        <div
          className="h-full bg-orange rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

ProgressBar.displayName = "ProgressBar";

export { ProgressBar };
export type { ProgressBarProps };
