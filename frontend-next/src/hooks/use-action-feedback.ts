"use client";

import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { type Locale, type LocaleRole } from "@/i18n/config";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { getAuthErrorMessage, type AuthMode } from "@/lib/auth-api";

interface RunOptions<T> {
  action: () => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
  authMode?: AuthMode;
  role?: LocaleRole;
  locale?: Locale;
  fallbackKey?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: unknown, message: string) => void;
  onFinally?: () => void;
}

export function useActionFeedback() {
  const [isRunning, setIsRunning] = useState(false);

  const run = async <T>({
    action,
    successMessage,
    errorMessage,
    authMode,
    role,
    locale,
    fallbackKey,
    onSuccess,
    onError,
    onFinally,
  }: RunOptions<T>) => {
    if (isRunning) {
      return;
    }

    setIsRunning(true);

    try {
      const result = await action();
      if (successMessage) {
        toast.success(successMessage);
      }
      if (onSuccess) {
        await onSuccess(result);
      }
      return result;
    } catch (error) {
      let message = authMode
        ? getAuthErrorMessage(error, authMode, { role, locale })
        : role
          ? getLocalizedErrorMessage({
              role,
              locale,
              error,
              fallbackKey: fallbackKey ?? "errors.default",
            })
          : errorMessage ??
            (error instanceof Error && error.message.trim()
              ? error.message.trim()
              : "Something went wrong. Please try again.");

      if (!authMode && !role) {
        const lowerMessage = message.toLowerCase();
        if (
          lowerMessage.includes("unauthorized") ||
          lowerMessage.includes("session expired") ||
          lowerMessage.includes("401")
        ) {
          message = "Your session expired. Please sign in again.";
        } else if (
          lowerMessage.includes("forbidden") ||
          lowerMessage.includes("not allowed") ||
          lowerMessage.includes("403")
        ) {
          message = "You do not have permission to perform this action.";
        } else if (
          lowerMessage.includes("conflict") ||
          lowerMessage.includes("stale") ||
          lowerMessage.includes("409")
        ) {
          message = "The data changed. Please refresh the page.";
        } else if (
          lowerMessage.includes("too many requests") ||
          lowerMessage.includes("rate limit") ||
          lowerMessage.includes("429")
        ) {
          message = "Too many requests. Please try again later.";
        } else if (
          lowerMessage.includes("internal server error") ||
          lowerMessage.includes("500")
        ) {
          message = "A system error occurred. Please try again.";
        }
      }

      toast.error(message);
      onError?.(error, message);
      throw error;
    } finally {
      setIsRunning(false);
      onFinally?.();
    }
  };

  return { run, isRunning };
}
