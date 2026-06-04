"use client";

import type { ReactNode } from "react";
import type { LocaleFlagKey } from "@/i18n/config";

type FlagProps = {
  className?: string;
  testId?: string;
};

function FlagFrame({
  children,
  className = "h-4 w-6",
  testId,
}: FlagProps & { children: ReactNode }) {
  return (
    <span
      className={`inline-flex overflow-hidden rounded-sm ring-1 ring-black/10 ${className}`.trim()}
      data-testid={testId}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

export function FlagRU({ className = "h-4 w-6", testId }: FlagProps) {
  return (
    <FlagFrame className={className} testId={testId}>
      <svg aria-hidden="true" viewBox="0 0 24 16" className="h-full w-full">
        <rect width="24" height="16" fill="#fff" />
        <rect y="5.333" width="24" height="5.334" fill="#1f5fbf" />
        <rect y="10.667" width="24" height="5.333" fill="#d52b1e" />
      </svg>
    </FlagFrame>
  );
}

export function FlagGB({ className = "h-4 w-6", testId }: FlagProps) {
  return (
    <FlagFrame className={className} testId={testId}>
      <svg aria-hidden="true" viewBox="0 0 24 16" className="h-full w-full">
        <rect width="24" height="16" fill="#012169" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="2" />
        <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="6" />
        <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3.2" />
      </svg>
    </FlagFrame>
  );
}

export function FlagVN({ className = "h-4 w-6", testId }: FlagProps) {
  return (
    <FlagFrame className={className} testId={testId}>
      <svg aria-hidden="true" viewBox="0 0 24 16" className="h-full w-full">
        <rect width="24" height="16" fill="#da251d" />
        <path
          d="m12 3.2 1.4 4.15h4.35l-3.5 2.55 1.35 4.1L12 11.45 8.4 14l1.35-4.1-3.5-2.55H10.6L12 3.2Z"
          fill="#ffde00"
        />
      </svg>
    </FlagFrame>
  );
}

export function renderLocaleFlag(flagKey: LocaleFlagKey, props?: FlagProps) {
  switch (flagKey) {
    case "ru":
      return <FlagRU {...props} />;
    case "gb":
      return <FlagGB {...props} />;
    case "vn":
      return <FlagVN {...props} />;
  }
}
