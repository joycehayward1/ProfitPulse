"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "cancel";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-4 py-2 text-[14px]",
  lg: "px-6 py-2.5 text-[15px]",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "bg-orange text-white",
    "hover:bg-[#BF4400] active:bg-[#A33B00]",
    "shadow-sm hover:shadow-md",
  ].join(" "),
  secondary: [
    "bg-transparent text-orange border border-orange/30",
    "hover:bg-orange-subtle active:bg-orange/10",
  ].join(" "),
  cancel: [
    "bg-surface-inset text-text-primary border border-border",
    "hover:bg-background active:bg-border-light",
  ].join(" "),
};

const Spinner = () => (
  <svg
    className="animate-spin -ml-0.5 mr-1.5 h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center",
          "font-medium",
          "rounded-lg",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2",
          sizeStyles[size],
          variantStyles[variant],
          fullWidth ? "w-full" : "",
          isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading && <Spinner />}
        {loading ? "Loading\u2026" : children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
