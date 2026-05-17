"use client";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (nextValue: number) => void;
  size?: "sm" | "md";
  testId?: string;
};

export function QuantityStepper({
  value,
  min = 1,
  max,
  disabled = false,
  onChange,
  size = "md",
  testId,
}: QuantityStepperProps) {
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

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white p-1 ${disabled ? "opacity-50" : ""}`}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        className={`public-button-secondary ${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Decrease quantity"
      >
        -
      </button>
      <span
        className={`${valueClass} text-center font-semibold text-[var(--foreground)]`}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || (max !== undefined && value >= max)}
        className={`public-button-secondary ${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
