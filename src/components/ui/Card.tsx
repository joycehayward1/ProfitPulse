"use client";

import { HTMLAttributes, forwardRef } from "react";

type CardVariant = "standard" | "featured" | "highlight";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  standard: [
    "bg-surface",
    "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
    "border border-[#F0EDE8]",
  ].join(" "),
  featured: [
    "bg-surface",
    "border-l-[3px] border-l-orange border border-[#F0EDE8]",
    "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
  ].join(" "),
  highlight: [
    "bg-background",
    "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
  ].join(" "),
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
          "rounded-lg p-md",
          "transition-all duration-200 ease-out",
          variantStyles[variant],
          isClickable
            ? "cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
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
