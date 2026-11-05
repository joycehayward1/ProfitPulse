"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import type { TourStep } from "@/lib/onboarding-tour";

interface ProductTourProps {
  steps: TourStep[];
  step: number;
  onStepChange: (step: number) => void;
  /** Close (X, Escape, "Skip for now"): progress is kept so the tour can be resumed. */
  onDismiss: () => void;
  onFinish: () => void;
  /** A step's page link: save progress, then go there. */
  onNavigate: (href: string, nextStep: number) => void;
}

interface Placement {
  target: DOMRect | null;
  targetId: string | null;
}

const MOBILE_BREAKPOINT = 768;
const CARD_WIDTH = 360;
const GAP = 14;
const SPOTLIGHT_PAD = 6;

function findVisibleTarget(ids: string[]): { el: HTMLElement; id: string } | null {
  for (const id of ids) {
    const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
    for (const el of Array.from(candidates)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return { el, id };
    }
  }
  return null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function cardPosition(target: DOMRect | null, cardHeight: number): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < MOBILE_BREAKPOINT || !target) return {};

  const clampTop = (top: number) => Math.min(Math.max(top, 16), Math.max(16, vh - cardHeight - 16));
  const clampLeft = (left: number) => Math.min(Math.max(left, 16), vw - CARD_WIDTH - 16);

  // Sidebar links: sit to the right of the sidebar.
  if (target.right < vw / 3) {
    return { top: clampTop(target.top - 12), left: target.right + GAP };
  }
  if (target.bottom + GAP + cardHeight < vh) {
    return { top: target.bottom + GAP, left: clampLeft(target.left) };
  }
  if (target.top - GAP - cardHeight > 0) {
    return { top: target.top - GAP - cardHeight, left: clampLeft(target.left) };
  }
  return { top: clampTop(vh - cardHeight - 16), left: clampLeft(target.left) };
}

/**
 * Spotlight walkthrough. Highlights one element per step (the first visible
 * data-tour target) and explains it in a dialog card. On small screens the
 * card docks to the bottom and sidebar steps point at the menu button.
 */
export function ProductTour({ steps, step, onStepChange, onDismiss, onFinish, onNavigate }: ProductTourProps) {
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<Placement>({ target: null, targetId: null });
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);

  const measure = useCallback(() => {
    if (!current) return;
    const found = findVisibleTarget(current.targets);
    const rect = found ? found.el.getBoundingClientRect() : null;
    setPlacement({ target: rect, targetId: found?.id ?? null });
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    setCardStyle(cardPosition(rect, cardRef.current?.offsetHeight ?? 240));
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    const found = findVisibleTarget(current.targets);
    if (found && typeof found.el.scrollIntoView === "function") {
      found.el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    measure();
    // Smooth scrolling moves the target after the first measurement.
    const settle = window.setTimeout(measure, prefersReducedMotion() ? 0 : 350);
    return () => window.clearTimeout(settle);
  }, [current, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    return () => previousFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== "Tab" || !cardRef.current) return;
    const focusable = Array.from(
      cardRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!current) return null;

  const t = placement.target;
  const body = current.body;
  const showMobileHint = placement.targetId === "nav-mobile-menu" && current.mobileHint;

  return (
    <div className="fixed inset-0 z-[95]" onKeyDown={handleKeyDown}>
      {t ? (
        <div
          aria-hidden="true"
          className="fixed rounded-xl ring-2 ring-orange pointer-events-none motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: t.top - SPOTLIGHT_PAD,
            left: t.left - SPOTLIGHT_PAD,
            width: t.width + SPOTLIGHT_PAD * 2,
            height: t.height + SPOTLIGHT_PAD * 2,
            boxShadow: "0 0 0 9999px rgba(15, 15, 15, 0.55)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-black/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-tour-title"
        aria-describedby="product-tour-body"
        className={[
          "fixed bg-white rounded-2xl shadow-elevated border border-border-light p-lg",
          isMobile || !t
            ? "inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[360px]"
            : "w-[360px]",
        ].join(" ")}
        style={isMobile || !t ? undefined : cardStyle}
      >
        <div className="flex items-start justify-between gap-sm mb-xs">
          <p className="text-label uppercase tracking-wider text-orange font-semibold" aria-live="polite">
            Step {step + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close tour"
            className="-mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
          >
            <Icon icon="ph:x-bold" className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <h2
          id="product-tour-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-heading font-semibold text-text-primary mb-xs focus:outline-none"
        >
          {current.title}
        </h2>
        <p id="product-tour-body" className="text-body-sm text-text-secondary leading-relaxed">
          {body}
          {showMobileHint && <span className="block mt-1 font-medium text-text-primary">{current.mobileHint}</span>}
        </p>

        {current.action && !isLast && (
          <button
            type="button"
            onClick={() => onNavigate(current.action!.href, step + 1)}
            className="mt-sm inline-flex items-center gap-1 text-body-sm font-medium text-orange hover:text-[#BF4400] transition-colors"
          >
            {current.action.label}
            <Icon icon="lucide:arrow-up-right" className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}

        <div className="flex items-center gap-1.5 mt-md" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={["h-1.5 rounded-full motion-safe:transition-all", i === step ? "w-6 bg-orange" : "w-1.5 bg-border"].join(" ")}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-sm mt-md">
          {step === 0 ? (
            <button
              type="button"
              onClick={onDismiss}
              className="text-body-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip for now
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStepChange(step - 1)}
              className="inline-flex items-center gap-1 text-body-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <Icon icon="lucide:arrow-left" className="w-4 h-4" aria-hidden="true" />
              Back
            </button>
          )}

          <div className="flex items-center gap-sm">
            {isLast && current.action && (
              <button
                type="button"
                onClick={() => onNavigate(current.action!.href, steps.length)}
                className="px-3 py-2 rounded-lg text-body-sm font-medium text-orange border border-orange/30 hover:bg-orange/5 transition-colors"
              >
                {current.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? onFinish() : onStepChange(step + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange text-white text-body-sm font-medium hover:bg-[#BF4400] transition-colors shadow-sm"
            >
              {isLast ? "Finish tour" : "Next"}
              <Icon icon={isLast ? "lucide:check" : "lucide:arrow-right"} className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
