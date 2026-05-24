"use client";

import React from "react";
import { clsx } from "clsx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "link";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    // Tailwind classes mapping
    const baseStyles =
      "inline-flex items-center justify-center font-semibold transition-all duration-200 outline-none rounded-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none";

    const variants: Record<ButtonVariant, string> = {
      primary:
        "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500",
      secondary:
        "bg-slate-100 hover:bg-slate-200 text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-300",
      outline:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300",
      ghost:
        "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-200",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500",
      success:
        "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-500",
      warning:
        "bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-amber-100 focus-visible:ring-2 focus-visible:ring-amber-400",
      link: "text-indigo-600 hover:underline hover:text-indigo-700 p-0 rounded-none bg-transparent",
    };

    const sizes: Record<ButtonSize, string> = {
      xs: "px-2.5 py-1 text-[11px] font-semibold rounded-lg",
      sm: "px-3 py-1.5 text-xs font-semibold rounded-lg",
      md: "px-4 py-2 text-sm font-semibold",
      lg: "px-5 py-2.5 text-base font-semibold rounded-2xl",
      icon: "h-8 w-8 flex items-center justify-center p-0 rounded-full",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={clsx(
          baseStyles,
          variants[variant],
          sizes[size],
          loading && "relative text-transparent! select-none pointer-events-none",
          className
        )}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-800 dark:text-white">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
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
          </span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
