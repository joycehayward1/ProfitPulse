"use client";

type GaugeSize = "sm" | "md" | "lg";

interface HealthScoreGaugeProps {
  score: number;
  size?: GaugeSize;
  className?: string;
}

const sizeConfig: Record<GaugeSize, { dimension: number; strokeWidth: number; fontSize: string }> = {
  sm: { dimension: 100, strokeWidth: 8, fontSize: "28px" },
  md: { dimension: 160, strokeWidth: 10, fontSize: "44px" },
  lg: { dimension: 220, strokeWidth: 12, fontSize: "60px" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#43A047";
  if (score >= 50) return "#F9A825";
  return "#D32F2F";
}

function HealthScoreGauge({ score, size = "md", className = "" }: HealthScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const config = sizeConfig[size];
  const { dimension, strokeWidth, fontSize } = config;

  const center = dimension / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="img"
      aria-label={`Health score: ${clampedScore} out of 100`}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="transform -rotate-90"
      >
        {/* Dark background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="#2D2A26"
          stroke="#3A3632"
          strokeWidth={strokeWidth}
        />

        {/* Colored score ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Score number overlay */}
      <span
        className="absolute font-display text-white"
        style={{ fontSize }}
        aria-hidden="true"
      >
        {clampedScore}
      </span>
    </div>
  );
}

HealthScoreGauge.displayName = "HealthScoreGauge";

export { HealthScoreGauge, getScoreColor };
export type { HealthScoreGaugeProps, GaugeSize };
