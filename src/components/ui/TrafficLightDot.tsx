"use client";

type HealthStatus = "healthy" | "attention" | "critical";

interface TrafficLightDotProps {
  status: HealthStatus;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const statusColors: Record<HealthStatus, string> = {
  healthy: "bg-success",
  attention: "bg-warning",
  critical: "bg-error",
};

function TrafficLightDot({ status, label, pulse, className = "" }: TrafficLightDotProps) {
  const shouldPulse = pulse ?? status === "critical";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex">
        <span
          className={`w-[10px] h-[10px] rounded-full ${statusColors[status]}`}
          aria-hidden="true"
        />
        {shouldPulse && (
          <span
            className={`absolute inset-0 w-[10px] h-[10px] rounded-full ${statusColors[status]} animate-ping opacity-40`}
          />
        )}
      </span>
      {label && (
        <span className="font-body text-body text-text-secondary">{label}</span>
      )}
    </span>
  );
}

TrafficLightDot.displayName = "TrafficLightDot";

export { TrafficLightDot };
export type { TrafficLightDotProps, HealthStatus };
