import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

interface RunOptions<T> {
  action: () => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: T) => void | Promise<void>;
  onFinally?: () => void;
}

export function useActionFeedback() {
  const [isRunning, setIsRunning] = useState(false);

  const run = async <T>({
    action,
    successMessage,
    errorMessage = "Đã xảy ra lỗi. Vui lòng thử lại.",
    onSuccess,
    onFinally,
  }: RunOptions<T>) => {
    if (isRunning) return;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      let msg = err?.message || errorMessage;

      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes("unauthorized") || lowerMsg.includes("session expired") || lowerMsg.includes("401")) {
        msg = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      } else if (lowerMsg.includes("forbidden") || lowerMsg.includes("not allowed") || lowerMsg.includes("403")) {
        msg = "Bạn không có quyền thực hiện thao tác này.";
      } else if (lowerMsg.includes("conflict") || lowerMsg.includes("stale") || lowerMsg.includes("409")) {
        msg = "Dữ liệu đã thay đổi. Vui lòng tải lại trang.";
      } else if (lowerMsg.includes("too many requests") || lowerMsg.includes("rate limit") || lowerMsg.includes("429")) {
        msg = "Bạn thao tác quá nhanh. Vui lòng thử lại sau.";
      } else if (lowerMsg.includes("internal server error") || lowerMsg.includes("500")) {
        msg = "Có lỗi hệ thống. Vui lòng thử lại.";
      }

      toast.error(msg);
      throw err;
    } finally {
      setIsRunning(false);
      if (onFinally) {
        onFinally();
      }
    }
  };

  return { run, isRunning };
}
