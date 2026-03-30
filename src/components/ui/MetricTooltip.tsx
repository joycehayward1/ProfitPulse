"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface MetricTooltipProps {
  text: string;
  children: React.ReactNode;
}

export function MetricTooltip({ text, children }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 256;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Keep tooltip within viewport
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8;
    }

    // Show above if enough room, otherwise below
    const showAbove = rect.top > 100;
    const top = showAbove ? rect.top - 8 : rect.bottom + 8;

    setCoords({ top, left });
    setVisible(true);
  }, []);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] w-64 px-4 py-3 text-[13px] font-body leading-relaxed text-white bg-[#2D2A26] rounded-lg shadow-2xl pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform: "translateY(-100%)",
              animation: "fadeIn 150ms ease-out",
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </div>
  );
}

/** Small info icon that triggers a tooltip on hover */
export function InfoTooltip({ text }: { text: string }) {
  return (
    <MetricTooltip text={text}>
      <span className="inline-flex items-center justify-center w-4 h-4 text-text-muted hover:text-orange transition-colors cursor-help">
        <Icon icon="ph:info-bold" className="w-4 h-4" />
      </span>
    </MetricTooltip>
  );
}
