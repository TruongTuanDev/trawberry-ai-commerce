"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.replace("/seller/dashboard");
    }
  }, [router, user]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-md rounded-[1.5rem] px-8 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">Checking admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen px-4 py-4 sm:px-6 sm:py-6" data-testid="admin-shell">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1400px] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow)]">
        <aside className="hidden w-72 border-r border-[var(--border)] bg-[#2f2025] p-6 text-white lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Admin</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-2xl font-bold">Marketplace Ops</h1>
          <nav className="mt-8 space-y-2">
            <Link
              href="/admin/sellers"
              className={`flex rounded-2xl px-4 py-3 text-sm font-medium transition ${
                pathname.startsWith("/admin/sellers") ? "bg-white text-[#2f2025]" : "text-white/78 hover:bg-white/8"
              }`}
            >
              Seller approvals
            </Link>
            <Link href="/seller/dashboard" className="flex rounded-2xl px-4 py-3 text-sm font-medium text-white/78 transition hover:bg-white/8">
              Seller center
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
