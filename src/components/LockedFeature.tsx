"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";

interface LockedFeatureProps {
  /** When true, render the blur + lock overlay. When false, render children unchanged. */
  locked: boolean;
  children: ReactNode;
  /** Optional CTA text override. */
  label?: string;
  /** Optional className applied to the wrapper. */
  className?: string;
  /** When true, content is fully visible (no blur) but clicking still navigates to upgrade. */
  visibleWhenLocked?: boolean;
  /** Name of the feature being gated, surfaced as context on the pricing page. */
  feature?: string;
}

/**
 * Wraps any feature with a "Pro only" lock overlay.
 *
 * - When `locked` is false: renders children as-is.
 * - When `locked` is true: blurs children, disables interaction, overlays
 *   a lock icon + "Upgrade to Pro" link to /pricing.
 */
export function LockedFeature({
  locked,
  children,
  label = "Upgrade to Pro",
  className = "",
  visibleWhenLocked = false,
  feature,
}: LockedFeatureProps) {
  if (!locked) {
    return <>{children}</>;
  }

  const pricingHref = feature
    ? `/pricing?feature=${encodeURIComponent(feature)}`
    : "/pricing";

  if (visibleWhenLocked) {
    return (
      <Link href={pricingHref} className={`block ${className}`} aria-label={label}>
        {children}
      </Link>
    );
  }

  return (
    <div className={`relative isolate ${className}`}>
      {/* Blurred, non-interactive content */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[6px] opacity-60"
      >
        {children}
      </div>

      {/* Lock overlay */}
      <Link
        href={pricingHref}
        className={[
          "absolute inset-0 z-10",
          "flex flex-col items-center justify-center gap-2",
          "rounded-[inherit]",
          "bg-white/40 backdrop-blur-[2px]",
          "border border-orange/20",
          "transition-all duration-200",
          "hover:bg-white/60 hover:border-orange/40",
          "group",
        ].join(" ")}
        aria-label={label}
      >
        <div className="w-12 h-12 rounded-full bg-orange/10 flex items-center justify-center group-hover:bg-orange/20 transition-colors">
          <Icon icon="lucide:lock" className="text-orange" width={22} height={22} />
        </div>
        <div className="text-center px-md">
          <p className="text-body font-medium text-text-primary">{label}</p>
        </div>
      </Link>
    </div>
  );
}
