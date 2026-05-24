"use client";

import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { getAuthErrorMessage, type AuthMode } from "@/lib/auth-api";

interface RunOptions<T> {
  action: () => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
  authMode?: AuthMode;
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: unknown, message: string) => void;
  onFinally?: () => void;
}

export function useActionFeedback() {
  const [isRunning, setIsRunning] = useState(false);

  const run = async <T>({
    action,
    successMessage,
    errorMessage = "Đã xảy ra lỗi. Vui lòng thử lại.",
    authMode,
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
        ? getAuthErrorMessage(error, authMode)
        : error instanceof Error && error.message
          ? error.message
          : errorMessage;

      if (!authMode) {
        const lowerMessage = message.toLowerCase();
        if (
          lowerMessage.includes("unauthorized") ||
          lowerMessage.includes("session expired") ||
          lowerMessage.includes("401")
        ) {
          message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
        } else if (
          lowerMessage.includes("forbidden") ||
          lowerMessage.includes("not allowed") ||
          lowerMessage.includes("403")
        ) {
          message = "Bạn không có quyền thực hiện thao tác này.";
        } else if (
          lowerMessage.includes("conflict") ||
          lowerMessage.includes("stale") ||
          lowerMessage.includes("409")
        ) {
          message = "Dữ liệu đã thay đổi. Vui lòng tải lại trang.";
        } else if (
          lowerMessage.includes("too many requests") ||
          lowerMessage.includes("rate limit") ||
          lowerMessage.includes("429")
        ) {
          message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
        } else if (
          lowerMessage.includes("internal server error") ||
          lowerMessage.includes("500")
        ) {
          message = "Có lỗi hệ thống. Vui lòng thử lại.";
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
