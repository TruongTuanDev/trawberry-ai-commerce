"use client";

import { useState } from "react";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
  onMaxExceeded?: () => void;
  size?: "sm" | "md";
  testId?: string;
};

export function QuantityStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  onMaxExceeded,
  size = "md",
  testId,
}: QuantityStepperProps) {
  const [inputValue, setInputValue] = useState<string | null>(null);
  const compact = size === "sm";
  const buttonClass = compact
    ? "h-9 w-9 rounded-xl text-base"
    : "h-11 w-11 rounded-2xl text-lg";
  const valueClass = compact
    ? "min-w-8 text-sm"
    : "min-w-10 text-base";

  const clamp = (nextValue: number) => {
    const lowerBound = Math.max(min, nextValue);
    if (max === undefined) {
      return lowerBound;
    }
    return Math.min(lowerBound, max);
  };

  const normalizeValue = (rawValue: string) => {
    if (!rawValue.trim()) {
      return min;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return min;
    }

    const normalized = clamp(Math.floor(parsed));
    if (max !== undefined && parsed > max) {
      onMaxExceeded?.();
    }
    return normalized;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white p-1 ${disabled ? "opacity-50" : ""}`}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => {
          setInputValue(null);
          onChange(clamp(value - 1));
        }}
        disabled={disabled || value <= min}
        className={`public-button-secondary ${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <input
        value={inputValue ?? String(value)}
        inputMode="numeric"
        pattern="[0-9]*"
        onChange={(event) => {
          const nextValue = event.target.value.replace(/\D+/g, "");
          setInputValue(nextValue);
          if (!nextValue) {
            return;
          }

          const parsed = Number(nextValue);
          if (!Number.isFinite(parsed)) {
            return;
          }

          if (max !== undefined && parsed > max) {
            onMaxExceeded?.();
          }
          onChange(clamp(parsed));
        }}
        onBlur={() => {
          const normalized = normalizeValue(inputValue ?? String(value));
          setInputValue(null);
          onChange(normalized);
        }}
        disabled={disabled}
        aria-label="Quantity"
        className={`${valueClass} rounded-xl border-none bg-transparent px-1 text-center font-semibold text-[var(--foreground)] outline-none`}
        data-testid={testId ? `${testId}-value` : undefined}
      />
      <button
        type="button"
        onClick={() => {
          setInputValue(null);
          onChange(clamp(value + 1));
        }}
        disabled={disabled || (max !== undefined && value >= max)}
        className={`public-button-secondary ${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
