"use client";

import { HTMLAttributes, forwardRef } from "react";

type CardVariant = "standard" | "featured" | "highlight";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  standard: "bg-surface border border-border-light shadow-card",
  featured: "bg-surface border-l-[3px] border-l-orange border border-border-light shadow-card",
  highlight: "bg-surface-inset border border-border-light shadow-xs",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "standard", className = "", onClick, children, ...props }, ref) => {
    const isClickable = !!onClick;

    return (
      <div
        ref={ref}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        className={[
          "rounded-xl p-lg",
          "transition-all duration-150 ease-out",
          variantStyles[variant],
          isClickable
            ? "cursor-pointer hover:shadow-medium hover:border-border active:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card };
export type { CardProps, CardVariant };
