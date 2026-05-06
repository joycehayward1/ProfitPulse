"use client";

import { useState, useEffect } from "react";

type GaugeSize = "sm" | "md" | "lg";

interface HealthScoreGaugeProps {
  score: number;
  size?: GaugeSize;
  className?: string;
  showIcon?: boolean;
  animate?: boolean;
}

const sizeConfig: Record<GaugeSize, { dimension: number; strokeWidth: number; fontSize: string; trackWidth: number }> = {
  sm: { dimension: 110, strokeWidth: 6, fontSize: "32px", trackWidth: 6 },
  md: { dimension: 180, strokeWidth: 8, fontSize: "48px", trackWidth: 8 },
  lg: { dimension: 240, strokeWidth: 10, fontSize: "64px", trackWidth: 10 },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#E65100";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Thriving";
  if (score >= 75) return "Solid";
  if (score >= 60) return "Attention";
  if (score >= 40) return "At Risk";
  return "Critical";
}

function HealthScoreGauge({
  score,
  size = "md",
  className = "",
  animate = true
}: HealthScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const config = sizeConfig[size];
  const { dimension, strokeWidth, fontSize, trackWidth } = config;

  const [displayScore, setDisplayScore] = useState(animate ? 0 : clampedScore);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(clampedScore);
      return;
    }

    const duration = 1200;
    const steps = 60;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(clampedScore);
        clearInterval(timer);
      } else {
        const progress = currentStep / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayScore(Math.floor(clampedScore * eased));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [clampedScore, animate]);

  const center = dimension / 2;
  const radius = center - strokeWidth - 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      style={{ width: dimension, height: dimension }}
      role="img"
      aria-label={`Health score: ${clampedScore} out of 100`}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="transform -rotate-90"
      >
        {/* Light track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#F0EDEB"
          strokeWidth={trackWidth}
        />

        {/* Score arc */}
        <defs>
          <linearGradient id={`gauge-grad-${clampedScore}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#gauge-grad-${clampedScore})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Score number — centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-text-primary tabular-nums"
          style={{ fontSize }}
          aria-hidden="true"
        >
          {displayScore}
        </span>
        {size === "lg" && (
          <span
            className="text-label uppercase tracking-wider mt-1"
            style={{ color }}
          >
            {getScoreLabel(clampedScore)}
          </span>
        )}
      </div>
    </div>
  );
}

HealthScoreGauge.displayName = "HealthScoreGauge";

export { HealthScoreGauge, getScoreColor };
export type { HealthScoreGaugeProps, GaugeSize };
