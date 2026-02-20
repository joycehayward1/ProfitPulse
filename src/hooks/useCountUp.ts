import { useState, useEffect, useRef } from "react";

export interface UseCountUpOptions {
  /**
   * Target number to count up to
   */
  end: number;

  /**
   * Starting number (default: 0)
   */
  start?: number;

  /**
   * Animation duration in milliseconds (default: 1500)
   */
  duration?: number;

  /**
   * Number of decimal places (default: 0)
   */
  decimals?: number;

  /**
   * Easing function (default: easeOutExpo)
   */
  easingFn?: (t: number, b: number, c: number, d: number) => number;

  /**
   * Delay before animation starts in milliseconds (default: 0)
   */
  delay?: number;
}

// Easing functions
const easeOutExpo = (t: number, b: number, c: number, d: number): number => {
  return t === d ? b + c : c * (-Math.pow(2, (-10 * t) / d) + 1) + b;
};

const easeOutCubic = (t: number, b: number, c: number, d: number): number => {
  return c * ((t = t / d - 1) * t * t + 1) + b;
};

/**
 * Hook for animating number count-ups with customizable easing
 *
 * @example
 * const count = useCountUp({ end: 1000, duration: 2000 });
 * return <div>{count}</div>;
 *
 * @example With currency formatting
 * const count = useCountUp({ end: 5000, decimals: 2 });
 * return <div>${count.toLocaleString()}</div>;
 */
export function useCountUp({
  end,
  start = 0,
  duration = 1500,
  decimals = 0,
  easingFn = easeOutExpo,
  delay = 0,
}: UseCountUpOptions): number {
  const [count, setCount] = useState(start);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    let startTimestamp: number;
    let delayTimeout: NodeJS.Timeout | undefined;

    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      const currentCount = easingFn(
        progress * duration,
        start,
        end - start,
        duration
      );

      setCount(parseFloat(currentCount.toFixed(decimals)));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    const startAnimation = () => {
      frameRef.current = requestAnimationFrame(animate);
    };

    if (delay > 0) {
      delayTimeout = setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (delayTimeout) {
        clearTimeout(delayTimeout);
      }
    };
  }, [end, start, duration, decimals, easingFn, delay]);

  return count;
}

/**
 * Format a number as currency using count-up animation
 *
 * @example
 * const formatted = useCountUpCurrency({ end: 5000, currency: 'USD' });
 * return <div>{formatted}</div>; // "$5,000"
 */
export function useCountUpCurrency({
  end,
  start = 0,
  duration = 1500,
  delay = 0,
  currency = "USD",
  locale = "en-US",
}: UseCountUpOptions & { currency?: string; locale?: string }): string {
  const count = useCountUp({ end, start, duration, decimals: 0, delay });

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(count);
}

// Export easing functions for custom use
export const easingFunctions = {
  easeOutExpo,
  easeOutCubic,
};
