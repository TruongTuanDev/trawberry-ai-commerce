"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, pathname, router, user]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel rounded-[1.5rem] px-8 py-6 text-sm text-[var(--muted)]">
          Loading seller workspace...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
