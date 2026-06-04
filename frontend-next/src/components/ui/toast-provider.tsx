"use client";

import React, { useEffect, useState } from "react";
import { subscribe, toast, Toast } from "./use-toast";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return subscribe(setToasts);
  }, []);

  return (
    <>
      {children}
      <div
        className="fixed inset-x-4 bottom-4 z-[9999] flex max-w-none flex-col gap-2 sm:right-4 sm:left-auto sm:w-full sm:max-w-sm sm:px-0"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const typeClasses = {
            success: "bg-emerald-50 border-emerald-200 text-emerald-800",
            error: "bg-rose-50 border-rose-200 text-rose-800",
            warning: "bg-amber-50 border-amber-200 text-amber-800",
            info: "bg-blue-50 border-blue-200 text-blue-800",
          }[t.type];

          const typeIcons = {
            success: (
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            error: (
              <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            warning: (
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ),
            info: (
              <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          }[t.type];

          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 ${typeClasses}`}
              role="alert"
              data-testid={`toast-${t.type}`}
            >
              {typeIcons}
              <div className="flex-1 text-sm font-semibold leading-5" data-testid={`toast-message-${t.type}`}>
                {t.message}
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="text-gray-400 hover:text-gray-600 transition shrink-0"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
