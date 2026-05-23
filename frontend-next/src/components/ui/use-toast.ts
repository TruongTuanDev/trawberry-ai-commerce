export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toasts: Toast[]) => void;

type ToastStore = {
  __toasts?: Toast[];
  __toastListeners?: Set<ToastListener>;
};

// Bulletproof singleton pattern across dynamic Next.js chunks via window object
const globalObject: ToastStore =
  typeof window !== "undefined" ? (window as Window & ToastStore) : {};

if (!globalObject.__toasts) {
  globalObject.__toasts = [];
}
if (!globalObject.__toastListeners) {
  globalObject.__toastListeners = new Set<ToastListener>();
}

const getToasts = (): Toast[] => globalObject.__toasts ?? [];
const setToasts = (newToasts: Toast[]) => {
  globalObject.__toasts = newToasts;
};
const getListeners = (): Set<ToastListener> =>
  globalObject.__toastListeners ?? new Set<ToastListener>();

function notify() {
  const currentToasts = getToasts();
  for (const listener of getListeners()) {
    try {
      listener([...currentToasts]);
    } catch {
      // Ignored
    }
  }
}

export const toast = {
  success(message: string, duration = 3000) {
    this.show(message, "success", duration);
  },
  error(message: string, duration = 4000) {
    this.show(message, "error", duration);
  },
  info(message: string, duration = 3000) {
    this.show(message, "info", duration);
  },
  warning(message: string, duration = 4000) {
    this.show(message, "warning", duration);
  },
  show(message: string, type: ToastType, duration = 3000) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type, duration };
    setToasts([...getToasts(), newToast]);
    notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  },
  dismiss(id: string) {
    setToasts(getToasts().filter((t) => t.id !== id));
    notify();
  },
};

export function subscribe(listener: ToastListener) {
  getListeners().add(listener);
  listener([...getToasts()]);
  return () => {
    getListeners().delete(listener);
  };
}
