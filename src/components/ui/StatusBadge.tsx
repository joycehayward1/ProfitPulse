"use client";

type HealthStatus = "healthy" | "attention" | "critical";

interface StatusBadgeProps {
  status: HealthStatus;
  className?: string;
}

const statusConfig: Record<HealthStatus, { label: string; classes: string }> = {
  healthy: {
    label: "Healthy",
    classes: "bg-[#E8F5E9] text-success",
  },
  attention: {
    label: "Attention",
    classes: "bg-[#FFF8E1] text-[#E68A00]",
  },
  critical: {
    label: "Critical",
    classes: "bg-[#FFEBEE] text-error",
  },
};

function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={[
        "inline-flex items-center",
        "px-3 py-1",
        "rounded-full",
        "font-body text-small font-semibold",
        config.classes,
        className,
      ].join(" ")}
    >
      {config.label}
    </span>
  );
}

StatusBadge.displayName = "StatusBadge";

export { StatusBadge };
export type { StatusBadgeProps };
