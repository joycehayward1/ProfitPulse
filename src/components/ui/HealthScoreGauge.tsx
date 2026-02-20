"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

type GaugeSize = "sm" | "md" | "lg";

interface HealthScoreGaugeProps {
  score: number;
  size?: GaugeSize;
  className?: string;
  showIcon?: boolean;
  animate?: boolean;
}

const sizeConfig: Record<GaugeSize, { dimension: number; strokeWidth: number; fontSize: string; iconSize: string }> = {
  sm: { dimension: 100, strokeWidth: 8, fontSize: "28px", iconSize: "24px" },
  md: { dimension: 160, strokeWidth: 10, fontSize: "44px", iconSize: "36px" },
  lg: { dimension: 220, strokeWidth: 12, fontSize: "60px", iconSize: "48px" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "#43A047";
  if (score >= 50) return "#F9A825";
  return "#D32F2F";
}

function getScoreIcon(score: number): string {
  if (score >= 80) return "ph:heart-fill";
  if (score >= 50) return "ph:warning-fill";
  return "ph:x-circle-fill";
}

function HealthScoreGauge({
  score,
  size = "md",
  className = "",
  showIcon = true,
  animate = true
}: HealthScoreGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const config = sizeConfig[size];
  const { dimension, strokeWidth, fontSize, iconSize } = config;

  // Animated count-up effect
  const [displayScore, setDisplayScore] = useState(animate ? 0 : clampedScore);

  useEffect(() => {
    if (!animate) {
      setDisplayScore(clampedScore);
      return;
    }

    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = clampedScore / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayScore(clampedScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(increment * currentStep));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [clampedScore, animate]);

  const center = dimension / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);
  const icon = getScoreIcon(clampedScore);

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

        {/* Colored score ring with gradient */}
        <defs>
          <linearGradient id={`gauge-gradient-${clampedScore}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#gauge-gradient-${clampedScore})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-700 ease-out ${
            clampedScore >= 80 ? 'animate-pulse' : ''
          }`}
          style={{
            filter: clampedScore >= 80 ? 'drop-shadow(0 0 8px rgba(67, 160, 71, 0.4))' : 'none'
          }}
        />
      </svg>

      {/* Score number overlay */}
      <span
        className="absolute font-display text-white tabular-nums"
        style={{ fontSize }}
        aria-hidden="true"
      >
        {displayScore}
      </span>

      {/* Center icon */}
      {showIcon && (
        <Icon
          icon={icon}
          className="absolute"
          style={{
            fontSize: iconSize,
            color: color,
            top: `${dimension * 0.65}px`,
            opacity: 0.9
          }}
        />
      )}
    </div>
  );
}

HealthScoreGauge.displayName = "HealthScoreGauge";

export { HealthScoreGauge, getScoreColor };
export type { HealthScoreGaugeProps, GaugeSize };
