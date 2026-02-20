"use client";

import React, { forwardRef, useState, useEffect } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Format a number string to currency display (with commas, no $ prefix)
 * Input: "12345.67" -> Output: "12,345.67"
 */
const formatCurrency = (value: string): string => {
  // Remove all non-digit and non-decimal characters
  const cleaned = value.replace(/[^\d.]/g, '');

  // Split into dollars and cents
  const parts = cleaned.split('.');
  const dollars = parts[0];
  const cents = parts[1];

  // Add commas to dollars
  const formattedDollars = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Reconstruct with cents (limit to 2 decimal places)
  if (cents !== undefined) {
    return `${formattedDollars}.${cents.slice(0, 2)}`;
  }

  return formattedDollars;
};

/**
 * Extract raw numeric value from formatted string
 * Input: "12,345.67" -> Output: "12345.67"
 */
const unformatCurrency = (value: string): string => {
  return value.replace(/,/g, '');
};

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ label, error, helperText, required, value = '', onChange, className = '', id, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const inputId = id || `currency-input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Sync external value changes
    useEffect(() => {
      if (value) {
        setDisplayValue(formatCurrency(value));
      } else {
        setDisplayValue('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty value
      if (inputValue === '') {
        setDisplayValue('');
        onChange?.('');
        return;
      }

      // Format and update
      const formatted = formatCurrency(inputValue);
      setDisplayValue(formatted);

      // Pass raw value to parent
      const raw = unformatCurrency(formatted);
      onChange?.(raw);
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-body text-text-secondary mb-2"
          >
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-primary font-body text-lg">
            $
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            className={`
              w-full pl-10 pr-4 py-3 rounded-md
              bg-white border-2
              font-body text-lg text-text-primary
              placeholder:text-text-muted
              transition-all duration-200
              focus:outline-none focus:ring-0
              ${error
                ? 'border-error focus:border-error'
                : 'border-gray-300 focus:border-orange hover:border-gray-400'
              }
              disabled:bg-gray-50 disabled:text-text-muted disabled:cursor-not-allowed
              ${className}
            `}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            {...props}
          />
        </div>

        {error && (
          <p id={errorId} className="mt-2 text-sm text-error font-body">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="mt-2 text-sm text-text-muted font-body">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
