"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const describedBy = [error ? errorId : null, helperText ? helperId : null]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="flex flex-col gap-[6px]">
        {label && (
          <label
            htmlFor={inputId}
            className="text-body font-body font-medium text-text-secondary"
          >
            {label}
            {props.required && (
              <span className="text-error ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={[
            "w-full px-4 py-3",
            "font-body text-body text-text-primary",
            "bg-surface",
            "rounded-md",
            "border",
            "transition-all duration-200 ease-out",
            "placeholder:text-text-muted",
            error
              ? "border-error focus:border-error focus:ring-2 focus:ring-error/20"
              : "border-[#D1D5DB] focus:border-orange focus:ring-2 focus:ring-orange/20",
            "focus:outline-none",
            disabled ? "opacity-50 cursor-not-allowed bg-[#F9F9F9]" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {error && (
          <p id={errorId} className="text-small font-body text-error" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-small font-body text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
