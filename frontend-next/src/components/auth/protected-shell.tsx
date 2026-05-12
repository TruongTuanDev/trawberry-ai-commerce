"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);
  const sessionError = useAuthStore((state) => state.sessionError);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!hydrated || sessionChecked) {
      return;
    }

    void refreshMe().then((authenticated) => {
      setSessionChecked(true);
      if (!authenticated) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [hydrated, pathname, refreshMe, router, sessionChecked]);

  useEffect(() => {
    if (!hydrated || sessionLoading || !sessionChecked) {
      return;
    }

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, pathname, router, sessionChecked, sessionLoading, user]);

  if (!hydrated || sessionLoading || !sessionChecked || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-md rounded-[1.5rem] px-8 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">
            {!hydrated || sessionLoading ? "Restoring your seller session..." : "Redirecting to login..."}
          </p>
          {sessionError ? (
            <p className="mt-3 text-sm text-[var(--accent-strong)]">
              Session expired or missing. Please sign in again.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
